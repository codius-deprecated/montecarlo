package monty

import (
	"fmt"
	"github.com/emicklei/go-restful"
	"log"
	"net/http"
	"os"
	"path"
)

type RestServer struct {
	server     *http.Server
	brain      *Brain
	staticRoot string
	port       int
}

type ProjectStatusResource struct {
	brain *Brain
}

type ReviewList struct {
	Reviews []Review
}

func (self *ProjectStatusResource) Register(container *restful.Container) {
	ws := new(restful.WebService)
	ws.Path("/status").
		Doc("Project status").
		Produces(restful.MIME_JSON)
	ws.Route(ws.GET("").
		To(self.getStatus).
		Writes(ReviewList{}).
		Doc("Get project-wide status"))
	container.Add(ws)
}

func (self *ProjectStatusResource) getStatus(request *restful.Request, response *restful.Response) {
	list := ReviewList{}
	list.Reviews = self.brain.ReviewPRs()
	response.WriteEntity(list)
}

func (self *RestServer) serveIndex(request *restful.Request, response *restful.Response) {
	var actual string
	if request.PathParameter("subpath") != "" {
		actual = path.Join(self.staticRoot, request.PathParameter("subpath"))
	} else {
		actual = path.Join(self.staticRoot, "index.html")
	}
	fmt.Println("Serving up", actual)
	http.ServeFile(response.ResponseWriter, request.Request, actual)
}

type GithubHookResource struct {
	brain *Brain
}

type GithubResponse struct {
	Message string
}

func (self *GithubHookResource) handleHook(request *restful.Request, response *restful.Response) {
	switch request.Request.Header.Get("x-github-event") {
	case "status":
		self.brain.ReviewPRs()
	case "issue_comment":
		self.brain.ReviewPRs()
	case "pull_request":
		self.brain.SyncRepositories()
		self.brain.ReviewPRs()
	case "push":
		self.brain.ReviewPRs()
	case "ping":
		self.brain.SyncRepositories()
	}
	response.WriteEntity(GithubResponse{
		Message: "OK",
	})
}

func (self *GithubHookResource) Register(container *restful.Container) {
	ws := new(restful.WebService)
	ws.Path("/github-hook").
		Doc("Github hook").
		Produces(restful.MIME_JSON)
	ws.Route(ws.POST("").
		To(self.handleHook).
		Doc("Handle github hook"))
	container.Add(ws)
}

func NewRestServer(brain *Brain, port int) *RestServer {
	ret := new(RestServer)
	ret.staticRoot = "./static"

	wsContainer := restful.NewContainer()
	statusResource := ProjectStatusResource{brain: brain}
	statusResource.Register(wsContainer)

	staticService := new(restful.WebService)
	staticService.Path("/").
		Doc("Static UI files")
	staticService.Route(staticService.GET("{subpath:*}").
		To(ret.serveIndex))
	wsContainer.Add(staticService)

	githubResource := GithubHookResource{brain: brain}
	githubResource.Register(wsContainer)

	ret.brain = brain

	ret.port = port
	ret.server = &http.Server{Addr: fmt.Sprintf(":%v", port), Handler: wsContainer}
	return ret
}

func (self *RestServer) Run() {
	log.Printf("Server is listening on *:%v", self.port)
	restful.TraceLogger(log.New(os.Stdout, "[rest] ", log.LstdFlags|log.Lshortfile))
	self.server.ListenAndServe()
}
