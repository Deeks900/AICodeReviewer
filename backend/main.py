from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from agent import agent   

#This API endpoint extension will be calling
app = FastAPI()

class ReviewRequest(BaseModel):
    directoryPath: str
    apiKey:str

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
        