package repolist

import (
  "github.com/google/go-github/github"
)

type RepositoryList struct {
  client *github.Client
}

func New(client *github.Client) *RepositoryList {
  ret := new(RepositoryList)
  ret.client = client
  return ret
}

func (self *RepositoryList) List() *[]github.Repository {
  var repolist = make([]github.Repository, 0)

  teams , _, _ := self.client.Organizations.ListUserTeams(nil)
  for _, team := range teams {
    repos, _, _ := self.client.Organizations.ListTeamRepos(*team.ID, nil)
    for _, repo := range repos {
      repolist = append(repolist, repo)
    }
  }

  return &repolist
}
