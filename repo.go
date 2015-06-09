package monty

import (
	"fmt"
)

type Repo struct {
	FullName *string
	Owner    *string
	Name     *string
}

func NewRepo(owner *string, name *string) *Repo {
	ret := new(Repo)
	ret.Owner = owner
	ret.Name = name
	fname := fmt.Sprintf("%s/%s", owner, name)
	ret.FullName = &fname
	return ret
}
