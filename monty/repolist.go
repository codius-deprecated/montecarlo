package monty

import (
	"fmt"
	"github.com/google/go-github/github"
)

type RepositoryList struct {
	client *github.Client
}

func NewRepolist(client *github.Client) *RepositoryList {
	ret := new(RepositoryList)
	ret.client = client
	return ret
}

func (self *RepositoryList) List() *[]github.Repository {
	var repolist = make([]github.Repository, 0)

	teams, _, _ := self.client.Organizations.ListUserTeams(nil)
	for _, team := range teams {
		repos, _, _ := self.client.Organizations.ListTeamRepos(*team.ID, nil)
		for _, repo := range repos {
			repolist = append(repolist, repo)
		}
	}

	return &repolist
}

func (self *RepositoryList) EnableHooks() {
	for _, repo := range *self.List() {
		self.EnableHook(&repo)
	}
}

func (self *RepositoryList) EnableHook(repo *github.Repository) {
	hooks, _, _ := self.client.Repositories.ListHooks(*repo.Owner.Login, *repo.Name, nil)

	fmt.Println("Checking hooks on", *repo.FullName)
	hasHook := false

	for _, hook := range hooks {
		if *hook.Name == "web" {
			fmt.Println("\tHook:", hook.Config["url"])
			if hook.Config["url"] == "http://build.codius.org/github-hook" {
				hasHook = true
			}
		}
	}

	if !hasHook {
		fmt.Println("\tNeeds a hook!")
		name := "web"
		hook := github.Hook{
			Name: &name,
			Config: map[string]interface{}{
				"url": "http://build.codius.org/github-hook",
			},
			Events: []string{"*"},
		}
		self.client.Repositories.CreateHook(*repo.Owner.Login, *repo.Name, &hook)
	}
}
