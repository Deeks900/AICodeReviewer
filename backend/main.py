from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from agent import agent, explain_code   

app = FastAPI()

class ReviewRequest(BaseModel):
    directoryPath: str
    apiKey:str

class ExplainRequest(BaseModel):
    code: str
    language: str
    apiKey: str

#Frontend will be talking through this
@app.post("/review")
def review_code(req: ReviewRequest):
    print("This is called")
    print(req)
    try:
        print("check")
        api_key=req.apiKey
        print(api_key)
        agent(req.directoryPath, api_key)
        return {
            "status": "success",
            "message": "Code review completed",
            "summary_file": f"{req.directoryPath}/CODE_REVIEW_SUMMARY.txt"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/explain")
def explain_code_endpoint(req: ExplainRequest):
    try:
        explanation = explain_code(req.code, req.language, req.apiKey)
        return {"explanation": explanation}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
