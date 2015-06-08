package main

import (
	"./monty"
	"fmt"
	"github.com/codegangsta/cli"
	"github.com/google/go-github/github"
	"golang.org/x/oauth2"
	"os"
)

type tokenSource struct {
	token *oauth2.Token
}

func (t *tokenSource) Token() (*oauth2.Token, error) {
	return t.token, nil
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
			Usage: "Reviews open pull requests",
			Action: func(c *cli.Context) {
				robot.ReviewPRs()
			},
		},
		{
			Name:  "status",
			Usage: "Reports status of open pull requests",
			Action: func(c *cli.Context) {
				reviews := robot.ReviewPRs()
				for _, review := range reviews {
					fmt.Printf("%v/%v - %v\n", *review.Repository.FullName, *review.PullRequest.Number, *review.PullRequest.Title)
					fmt.Printf("\t+1s: %v/%v\n", review.Status.LGTMCount, 1)
					fmt.Printf("\tMergeable: %v\n", review.Status.BranchMergeable)
					fmt.Printf("\tReview requested: %v\n", review.Status.ReviewRequested)
					if review.Status.ReadyForMerge {
						fmt.Printf("\tReady!\n")
					} else {
						fmt.Printf("\tNot yet ready.\n")
					}
				}
			},
		},
	}

	app.Run(os.Args)
}
