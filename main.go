package main

import (
    "fmt"
    "os"
    "strings"
    "github.com/google/go-github/github"
    "github.com/golang/oauth2"
    "./repolist"
)

type tokenSource struct {
  token *oauth2.Token
}

func (t *tokenSource) Token() (*oauth2.Token, error) {
  return t.token, nil
}

type command struct {
  Owner *string
  Args []string
}

func extractCommands(s *string) ([]string) {
  ret := make([]string, 0)

  for _, line := range strings.Split(*s, "\n") {
    if strings.HasPrefix(line, "+r") {
      ret = append(ret, line)
    } else if strings.Contains(line, "LGTM") || strings.Contains(line, ":+1:") {
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
  ts := &tokenSource {
    &oauth2.Token {AccessToken: token},
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
      comments, _, _ := client.PullRequests.ListComments(*repo.Owner.Login,
          *repo.Name, *pr.Number, nil)

      for _, cmds := range extractCommands(pr.Body) {
        commands = append(commands, command{pr.User.Login, strings.Split(cmds, " ")})
      }

      for _, comment := range comments {
        for _, cmds := range extractCommands(comment.Body) {
          commands = append(commands, command{comment.User.Login, strings.Split(cmds, " ")})
        }
      }

      for _, cmd := range commands {
        if cmd.Args[0] == "+r" && len(cmd.Args) == 1 {
          fmt.Println("\t\tReview requested!")
        } else {
          fmt.Println("\t\tUNKNOWN COMMAND:", cmd.Args)
        }
      }
    }
  }
}
