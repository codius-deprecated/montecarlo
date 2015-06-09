package monty

import (
	"github.com/google/go-github/github"
	"gopkg.in/redis.v3"
	"log"
)

type Brain struct {
	client *github.Client
	repos  *RepositoryList
	memory *Memory
}

func NewBrain(client *github.Client, redisOptions *redis.Options) *Brain {
	ret := new(Brain)
	ret.memory = NewMemory(redisOptions)
	ret.client = client
	ret.repos = NewRepolist(client)
	return ret
}

func (self *Brain) SyncRepositories() {
	self.repos.EnableHooks()

	for _, repo := range *self.repos.List() {
		prs, _, _ := self.client.PullRequests.List(*repo.Owner, *repo.Name, nil)
		for _, pr := range prs {
			newPR := PullRequest{
				Number:     *pr.Number,
				Body:       *pr.Body,
				User:       *pr.User.Login,
				Title:      *pr.Title,
				SHA:        *pr.Head.SHA,
				Repository: &repo,
			}

			self.memory.RememberPullRequest(&newPR)
		}
	}
}

func (self *Brain) ReviewPRs() []Review {

	log.Printf("Reviewing all PRs")

	ret := make([]Review, 0)

	for _, repo := range *self.repos.List() {
		prs := self.memory.GetPullRequests(&repo)

		for _, pr := range prs {
			review := self.ReviewPR(repo, pr)
			ret = append(ret, review)
		}
	}

	return ret
}

func (self *Brain) ReviewPR(repo Repo, pr PullRequest) Review {

	log.Printf("Reviewing %v/%v", *repo.FullName, pr.Number)

	comments, _, _ := self.client.Issues.ListComments(*repo.Owner,
		*repo.Name, pr.Number, nil)

	buildStatuses, _, _ := self.client.Repositories.GetCombinedStatus(*repo.Owner,
		*repo.Name, pr.SHA, nil)

	review := Review{
		Repository:    repo,
		PullRequest:   pr,
		Comments:      comments,
		BuildStatuses: buildStatuses,
		Condition: Condition{
			Name:   "Overall",
			Passed: true,
		},
	}

	review.Condition.Add(ReviewLGTMs(review))
	review.Condition.Add(ReviewCommands(review))
	review.Condition.Add(ReviewBuildStatus(review))

	if review.Condition.Passed {
		review.Condition.Message = "All conditions met"
	} else {
		review.Condition.Message = "Not all conditions are met"
	}

	return review
}
