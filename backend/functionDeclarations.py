from google import genai
from google.genai import types
from tools import readFile, listFiles

#Functions Declaration for the model
listFilesFunction = {
    "name": "listFiles",
    "description": "Lists all the files lying in the Directory.",
    "parameters": {
        "type": "object",
        "properties": {
            "dirPath": {
                "type": "string",
                "description": "Directory Path from which all the files will be listed.",
            },
        },
        "required": ["dirPath"],
    },
}


readFileFunction = {
    "name": "readFile",
    "description": "Read the whole content of the file passed to this function.",
    "parameters": {
        "type": "object",
        "properties": {
            "filePath": {
                "type": "string",
                "description": "File Path of which the content will be read.",
            },
        },
        "required": ["filePath"],
    },
}

# writeFileFunction = {
#     "name": "writeFile",
#     "description": "Write the content given to this function in the file path passed to it.",
#     "parameters": {
#         "type": "object",
#         "properties": {
#             "filePath": {
#                 "type": "string",
#                 "description": "This contains the path of the file in which content will be written.",
#             },
#             "content": {
#                 "type": "string",
#                 "description": "This has the content which will be written in the file path mentioned to this function.",
#             },
#         },
#         "required": ["filePath", "content"],
#     },
# }