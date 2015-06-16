package monty

import (
	"github.com/google/go-github/github"
)

type Review struct {
	Condition     Condition
	PullRequest   *PullRequest
	Comments      []github.IssueComment
	BuildStatuses *github.CombinedStatus
}
