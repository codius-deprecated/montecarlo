package monty

import (
	"fmt"
)

type PullRequest struct {
	Number     int
	SHA        string
	Body       string
	User       string
	Title      string
	Repository *Repo
}

func (self *PullRequest) ID() string {
	return fmt.Sprintf("%s/%d", *self.Repository.FullName, self.Number)
}
