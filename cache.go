package monty

import (
	"fmt"
	"gopkg.in/redis.v3"
	"log"
	"strconv"
)

type Memory struct {
	redis *redis.Client
}

func NewMemory(options *redis.Options) *Memory {
	ret := new(Memory)
	ret.redis = redis.NewClient(options)
	return ret
}

func (self *Memory) RememberPullRequest(pr *PullRequest) {
	self.redis.HMSet(fmt.Sprintf("pr:%v", pr.ID()),
		"SHA", pr.SHA,
		"Body", pr.Body,
		"User", pr.User,
		"Title", pr.Title,
		"Number", strconv.Itoa(pr.Number),
		"Repo.Owner", *pr.Repository.Owner,
		"Repo.Name", *pr.Repository.Name)
	log.Printf("Remembered: %v", pr.ID())
	self.redis.SAdd(fmt.Sprintf("pull-requests:%s", *pr.Repository.FullName), strconv.Itoa(pr.Number))
}

func (self *Memory) GetPullRequests(repo *Repo) []PullRequest {
	ids, err := self.redis.SMembers(fmt.Sprintf("pull-requests:%s", *repo.FullName)).Result()

	if err != nil {
		panic(err)
	}

	ret := make([]PullRequest, 0)

	for _, id := range ids {
		num, err := strconv.Atoi(id)
		if err != nil {
			panic(err)
		}
		ret = append(ret, *self.GetPullRequest(repo, num))
	}

	return ret
}

func (self *Memory) GetPullRequest(repo *Repo, num int) *PullRequest {
	val, err := self.redis.HGetAllMap(fmt.Sprintf("pr:%v/%v", *repo.FullName, num)).Result()

	if err != nil {
		panic(err)
	}

	if err != nil {
		panic(err)
	}

	return &PullRequest{
		Number:     num,
		SHA:        val["SHA"],
		Body:       val["Body"],
		User:       val["User"],
		Title:      val["Title"],
		Repository: repo,
	}
}
