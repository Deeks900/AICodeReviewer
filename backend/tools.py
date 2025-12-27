import os
from pathlib import Path

#These Directories and extensions will not be included while doing code review 
IGNORE_DIRS = {
    "node_modules", "__pycache__", ".venv", "venv", "env", ".git",
    ".idea", ".vscode", "dist", "build", "target", "coverage"
}
IGNORE_FILE_EXTENSIONS = {".lock", ".log"}

#Let's first create the function that will be listing all the files in the directory or subdirectories
def listFiles(dirPath):
    allFiles = []
    try:
        basePath = Path(dirPath)
        
        #rglob will help in recursively iterate subdirectories also
        for path in basePath.rglob('*'):
            #If this directory has to be ignored 
            if any(ignored_dir in path.parts for ignored_dir in IGNORE_DIRS):
                continue
            
            #If this is a file will send it for review to llm
            if path.is_file() and path.suffix not in IGNORE_FILE_EXTENSIONS:
                # Return absolute path instead of relative path
                allFiles.append(str(path.resolve()))
    except Exception as e:
        print(f"Exception {e} occured in listFiles function.")
    finally:
        return allFiles


#Now let's create the other function to read those files 
def readFile(filePath):
    content = ""
    try:
        path = Path(filePath)
        if path.is_file():
            content = path.read_text(encoding='utf-8')
        else:
            print(f"Not a valid file: {filePath}")
    except Exception as e:
        print(f"[readFile] Exception: {e}")
    finally:
        return content


#Thirdly write a function to write the contents to the file delivered by llm 
# def writeFile(filePath, content):
#     isSuccess = True
#     try:
#         path = Path(filePath)
        
#         with path.open('w', encoding='utf-8') as file:
#             file.write(content)
#             print("Data is written to file successfully.")
#     except Exception as e:
#         print(f"Exception {e} occurred in the writeFile function.")
#         isSuccess = False
#     finally:
#         return isSuccess        