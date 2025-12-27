from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from agent import agent, explain_code   

#This API endpoint extension will be calling
app = FastAPI()

class ReviewRequest(BaseModel):
    directoryPath: str
    apiKey:str

<<<<<<< HEAD
=======
class ExplainRequest(BaseModel):
    code: str
    language: str
    apiKey: str

#Frontend will be talking through this
>>>>>>> ai-code-reviewer-fix
@app.post("/review")
def review_code(req: ReviewRequest):
    try:
        #Generative AI starting point
        agent(req.directoryPath, req.apiKey)
        return {
            "status": "success",
            "message": "Code review completed",
            "summary_file": f"{req.directoryPath}/CODE_REVIEW_SUMMARY.txt"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
<<<<<<< HEAD
        
=======

@app.post("/explain")
def explain_code_endpoint(req: ExplainRequest):
    try:
        explanation = explain_code(req.code, req.language, req.apiKey)
        return {"explanation": explanation}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
>>>>>>> ai-code-reviewer-fix
