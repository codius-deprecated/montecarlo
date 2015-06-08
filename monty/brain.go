package monty

import (
	"github.com/google/go-github/github"
)

type Brain struct {
	client *github.Client
	repos  *RepositoryList
}

type Status struct {
	Conditions []Condition
}

type Review struct {
	Status        Status
	PullRequest   github.PullRequest
	Repository    github.Repository
	Comments      []github.IssueComment
	BuildStatuses *github.CombinedStatus
}

func (self *Status) AllConditionsPassed() bool {
	passed := true
	for _, condition := range self.Conditions {
		if !condition.Passed() {
			passed = false
		}
	}
	return passed
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

	comments, _, _ := self.client.Issues.ListComments(*repo.Owner.Login,
		*repo.Name, *pr.Number, nil)

	buildStatuses, _, _ := self.client.Repositories.GetCombinedStatus(*repo.Owner.Login,
		*repo.Name, *pr.Head.SHA, nil)

	review := Review{
		Repository:    repo,
		PullRequest:   pr,
		Comments:      comments,
		BuildStatuses: buildStatuses,
	}

	review.Status.Conditions = append(review.Status.Conditions, ReviewLGTMs(review))
	review.Status.Conditions = append(review.Status.Conditions, ReviewCommands(review))
	review.Status.Conditions = append(review.Status.Conditions, ReviewBuildStatus(review))

	return review
}
