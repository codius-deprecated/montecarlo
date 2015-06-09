package monty

import (
	"strings"
)

type command struct {
	Owner *string
	Args  []string
}

func extractCommands(s *string) []string {
	ret := make([]string, 0)

	for _, line := range strings.Split(*s, "\n") {
		if strings.HasPrefix(line, "+r") || strings.HasPrefix(line, "-r") {
			ret = append(ret, line)
		}
	}
	return ret
}
