package main

import (
	"./monty"
	"fmt"
	"github.com/codegangsta/cli"
	"github.com/google/go-github/github"
	"github.com/mgutz/ansi"
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

func printConditions(conditions []monty.Condition, depth int) {
	for _, condition := range conditions {
		var result string
		if condition.Passed() {
			result = ansi.Color(condition.Message, "green")
		} else {
			result = ansi.Color(condition.Message, "red")
		}
		fmt.Printf("%v%v:\t%v\n", strings.Repeat("\t", depth), condition.Name, result)
		printConditions(condition.Subconditions, depth+1)
	}
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

	robot := monty.NewBrain(client)

	app := cli.NewApp()

	app.Name = "montecarlo"
	app.Commands = []cli.Command{
		{
			Name:  "sync-hooks",
			Usage: "Updates github hooks on all repos",
			Action: func(c *cli.Context) {
				robot.SyncRepositories()
			},
		},
		{
			Name:  "review",
			Usage: "Reviews and merges open pull requests",
			Action: func(c *cli.Context) {
				reviews := robot.ReviewPRs()
				for _, review := range reviews {
					if review.Status.AllConditionsPassed() {
						fmt.Printf("Merging %s\n", review)
					}
				}
			},
		},
		{
			Name:  "status",
			Usage: "Reports status of open pull requests",
			Action: func(c *cli.Context) {
				reviews := robot.ReviewPRs()
				for _, review := range reviews {
					fmt.Printf("%v/%v - %v\n", *review.Repository.FullName, *review.PullRequest.Number, *review.PullRequest.Title)
					printConditions(review.Status.Conditions, 1)
					var result string
					if review.Status.AllConditionsPassed() {
						result = ansi.Color("Ready!", "green")
					} else {
						result = ansi.Color("Not yet ready.", "red")
					}
					fmt.Printf("\t%s\n", result)
				}
			},
		},
	}

	app.Run(os.Args)
}
