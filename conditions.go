package monty

import (
	"fmt"
	"strings"
)

type Condition struct {
	Name          string
	Passed        bool
	Required      bool
	Message       string
	Subconditions []Condition
}

func (self *Condition) Add(cond Condition) {
	self.Passed = self.Passed && cond.Passed
	self.Subconditions = append(self.Subconditions, cond)
}

func hasLGTM(s *string) bool {
	for _, line := range strings.Split(*s, "\n") {
		if strings.Contains(line, "LGTM") || strings.Contains(line, ":+1:") {
			return true
		}
	}
	return false
}

func ReviewLGTMs(review Review) Condition {
	passed := false
	subs := make([]Condition, 0)

	for _, comment := range review.Comments {
		if hasLGTM(comment.Body) {
			subs = append(subs, Condition{
				Name:    "+1",
				Message: fmt.Sprintf("from %s", *comment.User.Login),
				Passed:  true,
			})
			passed = true
		}
	}

	return Condition{
		Name:          "+1s",
		Message:       fmt.Sprintf("%v/%v", len(subs), 1),
		Passed:        passed,
		Subconditions: subs,
	}
}

func ReviewCommands(review Review) Condition {

	reviewRequestor := "nobody"

	commands := make([]command, 0)
	for _, cmds := range extractCommands(&review.PullRequest.Body) {
		commands = append(commands, command{&review.PullRequest.User, strings.Split(cmds, " ")})
	}

	for _, comment := range review.Comments {
		for _, cmds := range extractCommands(comment.Body) {
			commands = append(commands, command{comment.User.Login, strings.Split(cmds, " ")})
		}
	}

	reviewRequested := false

	for _, cmd := range commands {
		if cmd.Args[0] == "+r" && len(cmd.Args) == 1 {
			reviewRequested = true
			reviewRequestor = *cmd.Owner
		} else if cmd.Args[0] == "-r" && len(cmd.Args) == 1 {
			reviewRequested = false
		} else {
			fmt.Println("\t\tUNKNOWN COMMAND:", cmd.Args)
		}
	}

	return Condition{
		Name:    "Review requested",
		Passed:  reviewRequested,
		Message: fmt.Sprintf("%v, by %v", reviewRequested, reviewRequestor),
	}
}

func ReviewBuildStatus(review Review) Condition {
	passedAll := true
	buildConditions := make([]Condition, 0)
	for _, status := range review.BuildStatuses.Statuses {
		passed := *status.State == "success"
		if !passed {
			passedAll = false
		}
		buildConditions = append(buildConditions, Condition{
			Name:    *status.Context,
			Message: *status.Description,
			Passed:  passed,
		})
	}

	if passedAll {
		return Condition{
			Name:          "Overall build status",
			Subconditions: buildConditions,
			Passed:        true,
			Message:       "All builds passed.",
		}
	} else {
		return Condition{
			Name:          "Overall build status",
			Subconditions: buildConditions,
			Passed:        false,
			Message:       "Not all builds passed.",
		}
	}
}
