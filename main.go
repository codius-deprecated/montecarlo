package main

import (
	"./repolist"
	"fmt"
	"github.com/google/go-github/github"
	"golang.org/x/oauth2"
	"os"
	"strings"
)

type tokenSource struct {
	token *oauth2.Token
}

func (t *tokenSource) Token() (*oauth2.Token, error) {
	return t.token, nil
}

type command struct {
	Owner *string
	Args  []string
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

func extractCommands(s *string) []string {
	ret := make([]string, 0)

	for _, line := range strings.Split(*s, "\n") {
		if strings.HasPrefix(line, "+r") || strings.HasPrefix(line, "-r") {
			ret = append(ret, line)
		}
	}
	return ret
}

func main() {
	token := os.Getenv("GITHUB_TOKEN")

	if len(token) == 0 {
		panic("No github token")
	}
	ts := &tokenSource{
		&oauth2.Token{AccessToken: token},
	}

	tc := oauth2.NewClient(oauth2.NoContext, ts)
	client := github.NewClient(tc)

	repos := repolist.New(client)

	for _, repo := range *repos.List() {
		fmt.Println("Repo", *repo.FullName)
		prs, _, _ := client.PullRequests.List(*repo.Owner.Login, *repo.Name, nil)

		for _, pr := range prs {
			commands := make([]command, 0)

			fmt.Println("\t", *pr.State, pr.Mergeable, *pr.Number, *pr.Title)
			comments, _, _ := client.Issues.ListComments(*repo.Owner.Login,
				*repo.Name, *pr.Number, nil)

			lgtmCount := 0

			for _, cmds := range extractCommands(pr.Body) {
				commands = append(commands, command{pr.User.Login, strings.Split(cmds, " ")})
			}

			for _, comment := range comments {
				lgtmCount += extractLGTMs(comment.Body)
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
			if reviewRequested {
				fmt.Println("\t\tReview requested!")
				fmt.Println("\t\tLGTMs:", lgtmCount)
				if lgtmCount >= 1 {
					fmt.Println("\t\t\tREADY FOR MERGE!!!")
				}
			} else {
				fmt.Println("\t\tReview requested!")
			}
		}
	}
}
