import json
from pathlib import Path
from dotenv import load_dotenv
from google import genai
from google.genai import types
from functionDeclarations import listFilesFunction, readFileFunction
from toolsMapper import toolsMapper

# Load environment variables
load_dotenv()

#Global variable which will hold the directory path to be reviewed 
directoryPath = None

# Configure the client and tools
tools = types.Tool(function_declarations=[listFilesFunction, readFileFunction])

# -------------------- CONFIG --------------------
def buildConfig(directoryPath):
    full_instruction = f"""
    You are an expert code reviewer and fixer for any programming language, including HTML, CSS, JavaScript, TypeScript, Python, Java, etc.
    The Directory you have to review is {directoryPath}.

    ##IMPORTANT: EXCLUDED DIRECTORIES & FILES
    While reviewing the directory, you MUST IGNORE the following folders and files completely. Do NOT list, read, or analyze them:
    - node_modules/
    - __pycache__/
    - .venv/
    - venv/
    - env/
    - .git/
    - .idea/
    - .vscode/
    - dist/
    - build/
    - target/
    - coverage/
    - *.lock
    - *.log

    These directories contain generated or dependency code and reviewing them is a waste of tokens.

    ##RESPONSIBILITIES
    1. Use `listFiles` to retrieve ONLY relevant source code files (.py, .js, .ts, .html, .css, .json, .yaml).
    2. Use `readFile` to read each relevant file.
    3. Analyze and fix issues related to:
    - Bugs
    - Security
    - Code quality
    - Best practices
    - Performance
    4. For HTML/Markup: check doctype, meta, semantic HTML, alt tags, accessibility, inline styles.
    5. For CSS: syntax, browser compatibility, inefficient selectors, missing vendor prefixes, unused styles.
    6. For JS/TS/other: null/undefined errors, missing returns, async issues, hardcoded secrets, console.logs, code duplication.
    7. For other languages: syntax errors, best practice violations, security or performance issues.
    8. Do NOT modify files yet. Return structured JSON with:
    - file, line_start, line_end, severity (CRITICAL|MAJOR|MINOR), category (SECURITY|BUG|QUALITY|PERFORMANCE), comment, suggested_fix.
    9. Collect all issues in JSON array REVIEW_RESULTS.
    10. Return ONLY a single JSON object:

    {{
    "summary": {{
        "total_files_analyzed": "number",
        "total_issues": "number",
        "critical": "number",
        "major": "number",
        "minor": "number"
    }},
    "issues":  [
        {{
        "file": "string",
        "line_start": "number",
        "line_end": "number",
        "category": "SECURITY | BUG | QUALITY",
        "severity": "CRITICAL | MAJOR | MINOR",
        "comment": "string describing the issue and fix applied",
        "suggested_fix": "string (plain text, not escaped code)"
        }}
    ]
    }}
    """
    return types.GenerateContentConfig(tools=[tools], system_instruction=full_instruction)

# -------------------- HISTORY & FUNCTION CALL --------------------
history = []

def extract_function_call(response):
    candidate = response.candidates[0]
    if not candidate.content or not candidate.content.parts:
        return None
    for part in candidate.content.parts:
        if part.function_call:
            return part.function_call
    return None

#This will be forming the whole code review summary in JSON format
def getReviewResultJson(response):
    reviewJson = {"summary": {}, "issues": []}
    # Attempt to parse JSON safely
    raw_text = response.text.strip()
    json_text = ""

    # Extract JSON substring if there is extra text like Warning
    start_idx = raw_text.find("{")
    end_idx = raw_text.rfind("}")
    if start_idx != -1 and end_idx != -1:
        json_text = raw_text[start_idx:end_idx+1]

        #If Json text is there 
        if json_text:
            try:
                data = json.loads(json_text)
                if isinstance(data, dict):
                    reviewJson = data
                elif isinstance(data, list):
                    reviewJson = {"summary": {}, "issues": data}
            except Exception as e:
                print(f"Failed to parse JSON after cleaning: {e}")
        else:
            print("No JSON found in Gemini response.")
    return reviewJson      

#This function will be making a txt file containing whole code review summary for that folder 
def writeTextSummary(reviewJson):
    text_summary_path = Path(directoryPath) / "CODE_REVIEW_SUMMARY.txt"

    with text_summary_path.open("w", encoding="utf-8") as tf:
        summary = reviewJson.get("summary", {})
        tf.write("CODE REVIEW COMPLETE\n\n")
        tf.write(f"Total Files Analyzed: {summary.get('total_files_analyzed', 0)}\n")
        tf.write(f"Issues Fixed: {len(reviewJson.get('issues', []))}\n\n")

        tf.write("📌SECURITY FIXES:\n")
        for issue in reviewJson.get("issues", []):
            if issue.get("category") == "SECURITY":
                tf.write(f"- {issue['file']}:{issue['line_start']} – {issue['comment']}\n")

        tf.write("\n📌BUG FIXES:\n")
        for issue in reviewJson.get("issues", []):
            if issue.get("category") == "BUG":
                tf.write(f"- {issue['file']}:{issue['line_start']} – {issue['comment']}\n")

        tf.write("\n📌 CODE QUALITY IMPROVEMENTS:\n")
        for issue in reviewJson.get("issues", []):
            if issue.get("category") == "QUALITY":
                tf.write(f"- {issue['file']}:{issue['line_start']} – {issue['comment']}\n")

    print(f"Text summary written: {text_summary_path}")

    
# -------------------- AGENT --------------------
def agent(dirPath, apiKey):

    global directoryPath
    directoryPath = dirPath

    client = genai.Client(api_key=apiKey)
    try:
        print(f"Reviewing directory: {dirPath}")

        # Initial prompt
        history.append(types.Content(
            role="user",
            parts=[types.Part(text="""
            Review the code in the given directory.
            - Fix all issues using function calls if required.
            - When no more fixes are needed, return a FINAL JSON summary
            containing all issues and fixes exactly as instructed in system instructions.
            """)]
        ))

        # -------------------- FUNCTION CALL LOOP --------------------
        while True:
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=history,
                config=buildConfig(directoryPath),
            )
            
            #Getting the function call out of gemini response
            function_call = extract_function_call(response)

            if function_call:
                print(f"Function to call: {function_call.name}")
                toolResponse = toolsMapper[function_call.name](**function_call.args)
                print(f"Function response: {toolResponse}")

                function_response_part = types.Part.from_function_response(
                    name=function_call.name,
                    response={"result": toolResponse}
                )

                # Append responses to history
                history.append(types.Content(role="model", parts=[types.Part(function_call=function_call)]))
                history.append(types.Content(role="user", parts=[function_response_part]))
            else:
                print(f"No more function calls in response - {response.text}")
                reviewJson = getReviewResultJson(response)
                writeTextSummary(reviewJson)
                break

    except Exception as e:
        print(f"Exception in agent: {e}")
