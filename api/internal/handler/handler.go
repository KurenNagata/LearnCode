package handler

import (
	"context"

	"learning_language/api/internal/domain"
	"learning_language/api/internal/openapi"
	"learning_language/api/internal/service"
)

type Handler struct {
	problemSvc  *service.ProblemService
	judgeSvc    *service.JudgeService
	progressSvc *service.ProgressService
}

func NewHandler(ps *service.ProblemService, js *service.JudgeService, prog *service.ProgressService) *Handler {
	return &Handler{problemSvc: ps, judgeSvc: js, progressSvc: prog}
}

func (h *Handler) ProblemsInterfaceList(ctx context.Context, req openapi.ProblemsInterfaceListRequestObject) (openapi.ProblemsInterfaceListResponseObject, error) {
	language := ""
	if req.Params.Language != nil {
		language = *req.Params.Language
	}
	problems, err := h.problemSvc.ListProblems(ctx, language)
	if err != nil {
		return nil, err
	}
	out := make([]openapi.Problem, len(problems))
	for i, p := range problems {
		out[i] = toAPIModel(p)
	}
	return openapi.ProblemsInterfaceList200JSONResponse{Problems: out}, nil
}

func (h *Handler) ProblemsInterfaceGet(ctx context.Context, req openapi.ProblemsInterfaceGetRequestObject) (openapi.ProblemsInterfaceGetResponseObject, error) {
	p, err := h.problemSvc.GetProblem(ctx, req.Id)
	if err != nil {
		return nil, err
	}
	resp := openapi.ProblemsInterfaceGet200JSONResponse(toAPIModel(p))
	return resp, nil
}

func (h *Handler) ProblemsInterfaceSubmit(ctx context.Context, req openapi.ProblemsInterfaceSubmitRequestObject) (openapi.ProblemsInterfaceSubmitResponseObject, error) {
	result, err := h.judgeSvc.Judge(ctx, req.Id, req.Body.Language, req.Body.Code)
	if err != nil {
		return nil, err
	}
	return openapi.ProblemsInterfaceSubmit200JSONResponse{
		Passed:      result.Passed,
		TotalTests:  result.TotalTests,
		PassedTests: result.PassedTests,
	}, nil
}

func (h *Handler) ProgressInterfaceGet(ctx context.Context, _ openapi.ProgressInterfaceGetRequestObject) (openapi.ProgressInterfaceGetResponseObject, error) {
	ids, err := h.progressSvc.ListClearedProblemIDs(ctx)
	if err != nil {
		return nil, err
	}
	if ids == nil {
		ids = []int64{}
	}
	return openapi.ProgressInterfaceGet200JSONResponse{ClearedProblemIds: ids}, nil
}

func toAPIModel(p domain.Problem) openapi.Problem {
	op := openapi.Problem{
		Id:          p.ID,
		Language:    p.Language,
		Level:       p.Level,
		Order:       p.Order,
		Title:       p.Title,
		Description: p.Description,
	}
	if p.StarterCode != "" {
		op.StarterCode = &p.StarterCode
	}
	if p.Hint != "" {
		op.Hint = &p.Hint
	}
	if p.Explanation != "" {
		op.Explanation = &p.Explanation
	}
	if p.AnswerCode != "" {
		op.AnswerCode = &p.AnswerCode
	}
	return op
}
