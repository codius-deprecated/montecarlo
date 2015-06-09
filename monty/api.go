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
}

type ProjectStatusResource struct {
	brain *Brain
}

type ReviewList struct {
	Reviews []Review
}

func (self *ProjectStatusResource) Register(container *restful.Container) {
	ws := new(restful.WebService)
	ws.Path("/project").
		Doc("Projects").
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

func NewRestServer(brain *Brain) *RestServer {
	ret := new(RestServer)
	ret.staticRoot = "./static"

	wsContainer := restful.NewContainer()
	statusResource := ProjectStatusResource{brain: brain}
	statusResource.Register(wsContainer)

	staticService := new(restful.WebService)
	staticService.Path("/ui").
		Doc("Static UI files")
	staticService.Route(staticService.GET("{subpath:*}").
		To(ret.serveIndex))
	wsContainer.Add(staticService)

	ret.brain = brain

	ret.server = &http.Server{Addr: ":8080", Handler: wsContainer}
	return ret
}

func (self *RestServer) Run() {
	restful.TraceLogger(log.New(os.Stdout, "[rest] ", log.LstdFlags|log.Lshortfile))
	self.server.ListenAndServe()
}
