import "@typespec/http";

using TypeSpec.Http;

@service(#{ title: "Learning Language API" })
namespace LearningLanguageApi;

model Problem {
  id: int64;
  language: string;
  level: string;
  order: int32;
  title: string;
  description: string;
  starterCode?: string;
  hint?: string;
  explanation?: string;
  answerCode?: string;
}

model ListProblemsResponse {
  problems: Problem[];
}

model SubmitRequest {
  language: string;
  code: string;
}

model SubmitResponse {
  passed: boolean;
  totalTests: int32;
  passedTests: int32;
}

model ProgressResponse {
  clearedProblemIds: int64[];
}

model SignupRequest {
  username: string;
  password: string;
}

model LoginRequest {
  username: string;
  password: string;
}

model AuthResponse {
  token: string;
  username: string;
}

@route("/api/problems")
interface ProblemsInterface {
  @get list(@query language?: string): ListProblemsResponse;

  @get
  @route("{id}")
  get(@path id: int64): Problem;

  @post
  @route("{id}/submit")
  submit(@path id: int64, @body body: SubmitRequest): SubmitResponse;
}

@route("/api/progress")
interface ProgressInterface {
  @get get(): ProgressResponse;
}

@route("/api/auth")
interface AuthInterface {
  @post
  @route("signup")
  signup(@body body: SignupRequest): AuthResponse;

  @post
  @route("login")
  login(@body body: LoginRequest): AuthResponse;
}
