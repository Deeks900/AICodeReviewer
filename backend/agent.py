import json
from pathlib import Path
from dotenv import load_dotenv
from google import genai
from google.genai import types
from functionDeclarations import listFilesFunction, readFileFunction, writeFileFunction
from toolsMapper import toolsMapper

# Load environment variables
load_dotenv()

directoryPath = None

# Configure the client and tools
tools = types.Tool(function_declarations=[listFilesFunction, readFileFunction, writeFileFunction])

# -------------------- CONFIG --------------------
def buildConfig(directoryPath):
    """
    Gemini system instruction configuration with full instructions.
    """
    full_instruction = f"""
You are an expert code reviewer and fixer for any programming language, including HTML, CSS, JavaScript, TypeScript, Python, Java, etc.
The Directory you have to review is {directoryPath}.

## 🚫 IMPORTANT: EXCLUDED DIRECTORIES & FILES
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

⚠️ These directories contain generated or dependency code and reviewing them is a waste of tokens.

## ✅ RESPONSIBILITIES
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
"issues": [ ... ]
}}

11. After fixes, generate a **text summary** and save as CODE_REVIEW_SUMMARY.txt in {directoryPath}, with:
📊 CODE REVIEW COMPLETE
Total Files Analyzed: X
Files Fixed: Y
🔴 SECURITY FIXES: file_name:line – description
🟠 BUG FIXES: file_name:line – description
🟡 CODE QUALITY IMPROVEMENTS: file_name:line – description
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

# -------------------- AGENT --------------------
def agent(dirPath, apiKey):
    """
    Main Gemini agent to review & fix code
    """
    global directoryPath
    directoryPath = dirPath
    client = genai.Client(api_key=apiKey)
    REVIEW_RESULTS = {"summary": {}, "issues": []}

    try:
        print(f"Reviewing directory: {dirPath}")

        # Initial prompt
        history.append(types.Content(
            role="user",
            parts=[types.Part(text="Review the code in the given directory and fix all issues.")]
        ))

        # -------------------- FUNCTION CALL LOOP --------------------
        while True:
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=history,
                config=buildConfig(directoryPath),
            )

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
                print("No more function calls in response.")
                break

        # -------------------- FINAL JSON SUMMARY --------------------
        # Ask Gemini explicitly to summarize all issues in JSON format
        history.append(types.Content(
            role="user",
            parts=[types.Part(text="Now, summarize all issues and fixes in a single JSON object exactly as instructed in system instructions.")]
        ))

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=history,
            config=buildConfig(directoryPath),
        )

        print("=== Gemini Raw Response ===")
        print(response.text)
        print("==========================")
        # Attempt to parse JSON safely
        raw_text = response.text.strip()
        json_text = ""

        # Extract JSON substring if there is extra text
        start_idx = raw_text.find("{")
        end_idx = raw_text.rfind("}")
        if start_idx != -1 and end_idx != -1:
            json_text = raw_text[start_idx:end_idx+1]

        if json_text:
            try:
                data = json.loads(json_text)
                if isinstance(data, dict):
                    REVIEW_RESULTS = data
                elif isinstance(data, list):
                    REVIEW_RESULTS = {"summary": {}, "issues": data}
            except Exception as e:
                print(f"Failed to parse JSON after cleaning: {e}")
        else:
            print("No JSON found in Gemini response.")

        # -------------------- WRITE JSON SUMMARY --------------------
        json_summary_path = Path(directoryPath) / "CODE_REVIEW_SUMMARY.json"
        with json_summary_path.open("w", encoding="utf-8") as jf:
            json.dump(REVIEW_RESULTS, jf, indent=2)
        print(f"JSON summary written: {json_summary_path}")

        # -------------------- WRITE TEXT SUMMARY --------------------
        text_summary_path = Path(directoryPath) / "CODE_REVIEW_SUMMARY.txt"
        with text_summary_path.open("w", encoding="utf-8") as tf:
            summary = REVIEW_RESULTS.get("summary", {})
            tf.write("📊 CODE REVIEW COMPLETE\n\n")
            tf.write(f"Total Files Analyzed: {summary.get('total_files_analyzed', 0)}\n")
            tf.write(f"Files Fixed: {len(REVIEW_RESULTS.get('issues', []))}\n\n")

            tf.write("🔴 SECURITY FIXES:\n")
            for issue in REVIEW_RESULTS.get("issues", []):
                if issue.get("category") == "SECURITY":
                    tf.write(f"- {issue['file']}:{issue['line_start']} – {issue['comment']}\n")

            tf.write("\n🟠 BUG FIXES:\n")
            for issue in REVIEW_RESULTS.get("issues", []):
                if issue.get("category") == "BUG":
                    tf.write(f"- {issue['file']}:{issue['line_start']} – {issue['comment']}\n")

            tf.write("\n🟡 CODE QUALITY IMPROVEMENTS:\n")
            for issue in REVIEW_RESULTS.get("issues", []):
                if issue.get("category") == "QUALITY":
                    tf.write(f"- {issue['file']}:{issue['line_start']} – {issue['comment']}\n")

        print(f"Text summary written: {text_summary_path}")

    except Exception as e:
        print(f"Exception in agent: {e}")
