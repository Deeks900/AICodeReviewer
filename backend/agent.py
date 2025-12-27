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
You are an expert code reviewer. The directory is {directoryPath}.

Use listFiles to get files, readFile to read content, writeFile to fix issues.

Fix bugs, security, quality issues.

Return JSON: {{"summary": {{"total_files_analyzed": number, "total_issues": number, "critical": 0, "major": 0, "minor": 0}}, "issues": [{{"file": path, "line": number, "severity": "MAJOR|MINOR|CRITICAL", "description": "fix description"}}]}}
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
            parts=[types.Part(text=f"Review the code in the directory {directoryPath} and fix all issues. Start by calling the listFiles function with dirPath='{directoryPath}'.")]
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

                # If listFiles was called, prompt to read each file
                if function_call.name == "listFiles":
                    files = toolResponse
                    for file in files:
                        history.append(types.Content(
                            role="user",
                            parts=[types.Part(text=f"Call readFile for {file}")]
                        ))
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
                if issue.get("severity", "").lower() == "critical":
                    tf.write(f"- {issue['file']}:{issue['line']} – {issue['description']}\n")

            tf.write("\n🟠 BUG FIXES:\n")
            for issue in REVIEW_RESULTS.get("issues", []):
                if issue.get("severity", "").lower() == "major":
                    tf.write(f"- {issue['file']}:{issue['line']} – {issue['description']}\n")

            tf.write("\n🟡 CODE QUALITY IMPROVEMENTS:\n")
            for issue in REVIEW_RESULTS.get("issues", []):
                if issue.get("severity", "").lower() == "minor":
                    tf.write(f"- {issue['file']}:{issue['line']} – {issue['description']}\n")

        print(f"Text summary written: {text_summary_path}")

    except Exception as e:
        print(f"Exception in agent: {e}")
        REVIEW_RESULTS = {"summary": {"total_files_analyzed": 0, "total_issues": 0, "critical": 0, "major": 0, "minor": 0}, "issues": []}

    # Always write the summary files
    json_summary_path = Path(directoryPath) / "CODE_REVIEW_SUMMARY.json"
    with json_summary_path.open("w", encoding="utf-8") as jf:
        json.dump(REVIEW_RESULTS, jf, indent=2)
    print(f"JSON summary written: {json_summary_path}")

    # Write text summary
    text_summary_path = Path(directoryPath) / "CODE_REVIEW_SUMMARY.txt"
    with text_summary_path.open("w", encoding="utf-8") as tf:
        summary = REVIEW_RESULTS.get("summary", {})
        tf.write("📊 CODE REVIEW COMPLETE\n\n")
        tf.write(f"Total Files Analyzed: {summary.get('total_files_analyzed', 0)}\n")
        tf.write(f"Files Fixed: {len(REVIEW_RESULTS.get('issues', []))}\n\n")

        tf.write("🔴 SECURITY FIXES:\n")
        for issue in REVIEW_RESULTS.get("issues", []):
            if issue.get("severity", "").lower() == "critical":
                tf.write(f"- {issue['file']}:{issue['line']} – {issue['description']}\n")

        tf.write("\n🟠 BUG FIXES:\n")
        for issue in REVIEW_RESULTS.get("issues", []):
            if issue.get("severity", "").lower() == "major":
                tf.write(f"- {issue['file']}:{issue['line']} – {issue['description']}\n")

        tf.write("\n🟡 CODE QUALITY IMPROVEMENTS:\n")
        for issue in REVIEW_RESULTS.get("issues", []):
            if issue.get("severity", "").lower() == "minor":
                tf.write(f"- {issue['file']}:{issue['line']} – {issue['description']}\n")

    print(f"Text summary written: {text_summary_path}")

# -------------------- EXPLAIN CODE --------------------
def explain_code(code: str, language: str, api_key: str) -> str:
    """
    Use Gemini to explain the provided code snippet.
    """
    try:
        client = genai.Client(api_key=api_key)
        
        prompt = f"Explain the following {language} code in simple terms, including what it does, key concepts, and any important notes:\n\n{code}"
        
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[types.Content(role="user", parts=[types.Part(text=prompt)])]
        )
        
        return response.text.strip()
    except Exception as e:
        print(f"Exception in explain_code: {e}")
        return f"Error explaining code: {str(e)}"
