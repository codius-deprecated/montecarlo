package monty

import (
	"fmt"
	"strings"
)

type Condition struct {
	Name          string
	passed        bool
	Message       string
	Subconditions []Condition
}

func (self *Condition) Passed() bool {
	allPassed := self.passed
	for _, subcondition := range self.Subconditions {
		if !subcondition.Passed() {
			allPassed = false
		}
	}
	return allPassed
}

func extractLGTMs(s *string) int {
	sum := 0
	for _, line := range strings.Split(*s, "\n") {
		if strings.Contains(line, "LGTM") || strings.Contains(line, ":+1:") {
			sum++
		}
	}
	return sum
}

func ReviewLGTMs(review Review) Condition {
	lgtmCount := 0

	for _, comment := range review.Comments {
		lgtmCount += extractLGTMs(comment.Body)
	}

	return Condition{
		Name:    "+1s",
		Message: fmt.Sprintf("%v/%v", lgtmCount, 1),
		passed:  lgtmCount >= 1,
	}
}

func ReviewCommands(review Review) Condition {
	commands := make([]command, 0)
	for _, cmds := range extractCommands(review.PullRequest.Body) {
		commands = append(commands, command{review.PullRequest.User.Login, strings.Split(cmds, " ")})
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
		} else if cmd.Args[0] == "-r" && len(cmd.Args) == 1 {
			reviewRequested = false
		} else {
			fmt.Println("\t\tUNKNOWN COMMAND:", cmd.Args)
		}
	}

	return Condition{
		Name:    "Review requested",
		passed:  reviewRequested,
		Message: fmt.Sprintf("%v", reviewRequested),
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
			passed:  passed,
		})
	}

	if passedAll {
		return Condition{
			Name:          "Overall build status",
			Subconditions: buildConditions,
			passed:        true,
			Message:       "All builds passed.",
		}
	} else {
		return Condition{
			Name:          "Overall build status",
			Subconditions: buildConditions,
			passed:        false,
			Message:       "Not all builds passed.",
		}
	}
}
