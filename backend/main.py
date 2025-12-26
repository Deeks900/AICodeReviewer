from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from agent import agent   

app = FastAPI()

class ReviewRequest(BaseModel):
    directoryPath: str
    apiKey:str

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
