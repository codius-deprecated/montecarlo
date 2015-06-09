package monty

import (
	"github.com/google/go-github/github"
)

type Review struct {
	Condition     Condition
	PullRequest   *PullRequest
	Repository    *Repo
	Comments      []github.IssueComment
	BuildStatuses *github.CombinedStatus
}
