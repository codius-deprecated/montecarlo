package monty

import (
	"fmt"
	"github.com/google/go-github/github"
	"strings"
)

type Brain struct {
	client *github.Client
	repos  *RepositoryList
}

type Status struct {
	ReadyForMerge   bool
	LGTMCount       int
	BranchMergeable bool
	ReviewRequested bool
}

type Review struct {
	Status      Status
	PullRequest github.PullRequest
	Repository  github.Repository
}

func NewBrain(client *github.Client) *Brain {
	ret := new(Brain)
	ret.client = client
	ret.repos = NewRepolist(client)
	return ret
}

func (self *Brain) SyncRepositories() {
	self.repos.EnableHooks()
}

func (self *Brain) ReviewPRs() []Review {
	ret := make([]Review, 0)

	for _, repo := range *self.repos.List() {
		prs, _, _ := self.client.PullRequests.List(*repo.Owner.Login, *repo.Name, nil)

		for _, pr := range prs {
			ret = append(ret, self.ReviewPR(repo, pr))
		}
	}

	return ret
}

func (self *Brain) ReviewPR(repo github.Repository, pr github.PullRequest) Review {
	commands := make([]command, 0)
	review := Review{
		Repository:  repo,
		PullRequest: pr,
	}

	comments, _, _ := self.client.Issues.ListComments(*repo.Owner.Login,
		*repo.Name, *pr.Number, nil)

	review.Status.LGTMCount = 0

	for _, cmds := range extractCommands(pr.Body) {
		commands = append(commands, command{pr.User.Login, strings.Split(cmds, " ")})
	}

	for _, comment := range comments {
		review.Status.LGTMCount += extractLGTMs(comment.Body)
		for _, cmds := range extractCommands(comment.Body) {
			commands = append(commands, command{comment.User.Login, strings.Split(cmds, " ")})
		}
	}

	review.Status.ReviewRequested = false

	for _, cmd := range commands {
		if cmd.Args[0] == "+r" && len(cmd.Args) == 1 {
			review.Status.ReviewRequested = true
		} else if cmd.Args[0] == "-r" && len(cmd.Args) == 1 {
			review.Status.ReviewRequested = false
		} else {
			fmt.Println("\t\tUNKNOWN COMMAND:", cmd.Args)
		}
	}

	review.Status.ReadyForMerge = false

	if review.Status.ReviewRequested {
		if review.Status.LGTMCount >= 1 {
			review.Status.ReadyForMerge = true
		}
	}

	return review
}
