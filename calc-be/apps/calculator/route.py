from fastapi import APIRouter
import base64
from io import BytesIO
from apps.calculator.utils import analyze_image
from schema import ImageData
from PIL import Image
import re

router = APIRouter()

@router.post('')
async def run(data: ImageData):
    try:
        # Decode base64 image
        image_data = base64.b64decode(data.image.split(",")[1])
        image_bytes = BytesIO(image_data)
        image = Image.open(image_bytes)

        # Analyze with Gemini/model
        responses = analyze_image(image, dict_of_vars=data.dict_of_vars)

        if not responses:
            return {
                "status": "error",
                "message": "No recognizable mathematical or graphical content found in the image.",
                "data": []
            }

        formatted_data = []
        for r in responses:
            expr = r.get("expr", "").strip()
            result = str(r.get("result", "")).strip()
            assign_flag = bool(r.get("assign", False))

            # Detect whether the output is math or descriptive text
            is_math_expr = bool(re.search(r"[\d\+\-\*/=\^]", expr)) or bool(re.search(r"[\d\+\-\*/=\^]", result))

            # Clean LaTeX/unicode characters
            result = (
                result.replace("\\,", ", ")
                .replace("\\n", " ")
                .replace("\\", "")
                .replace(" ,", ",")
                .strip()
            )

            # Mark format for frontend
            formatted_data.append({
                "expr": expr or "Unrecognized input",
                "result": result or "No result generated",
                "assign": assign_flag,
                "is_math": is_math_expr  # ✅ helps frontend decide how to render
            })

        print("Processed responses:", formatted_data)

        return {
            "status": "success",
            "message": "Image processed successfully.",
            "count": len(formatted_data),
            "data": formatted_data
        }

    except Exception as e:
        print("Error processing image:", e)
        return {
            "status": "error",
            "message": f"Internal server error: {e}",
            "data": []
        }
