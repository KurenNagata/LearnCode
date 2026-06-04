package domain

type Problem struct {
	ID          int64
	Language    string
	Level       string
	Order       int32
	Title       string
	Description string
	StarterCode string
	Hint        string
	Explanation string
	AnswerCode  string
}

type TestCase struct {
	ID        int64
	ProblemID int64
	Stdin     string
	Stdout    string
	Hidden    bool
}
