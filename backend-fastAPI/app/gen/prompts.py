"""글 작업 프롬프트. 문장은 기준 커밋의 getStoryService.py와 getImgPromptService.py에서 그대로 옮겼다.

달라진 점: previous_response_id 대신 "Story so far:" 블록과 직전 질문을 넣고, 도입부의 charLook(의상) 필드를 빼고,
삽화 프롬프트(illustration)를 같은 응답의 필드로 받는다. 사용자 입력은 f-string 값으로만 들어간다(다시 format하지 않는다).
"""
import json

COMMON = (
    "You are an assistant that writes fairy tales for young children between the ages of 7 and 9. "
    "Your stories should be easy to understand, emotionally warm, and imaginative. "
    "Always write in a friendly, age-appropriate tone. Do not use complex vocabulary or abstract ideas. "
    "Vary sentence structures and opening styles to avoid repetition."
)

ILLUSTRATION = (
    "an image generation prompt for a fairytale-style illustration of the scene you just wrote. "
    "Based on a short scene describing the character’s behavior, generate a concise sequence of descriptive phrases. "
    "Do not write full sentences. Do not begin with phrases like “Illustrate a figure” or include any subject like “she” or “a person.” "
    "Instead, start directly with action, expression, posture, and magical or whimsical background elements. "
    "Do not include any description of appearance, clothing, or name. Keep the output between 200 and 300 characters. "
    "Use clear and natural English. Focusing on vivid, fragment-style visual descriptions."
)

REFINE = (
    "You are responsible for refining an array of separated fairytale scenes into a smoothly connected story. "
    "The input and output must remain in array format, and both the order and number of scenes must be preserved. "
    "Improve the flow and emotional continuity by adjusting expressions or adding transitional phrases within each scene. "
    "Keep the core meaning intact, but feel free to rephrase naturally. "
    "Each scene must be written in Korean and limited to 300 characters or fewer.  Do not include any extra explanations or formatting."
)

FEATURE_CARD = (
    "You are an assistant that generates image generation prompts from portrait photos. "
    "Analyze visible features—hairstyle, no facial expression—and describe them in a clear, natural English sentence that starts with 'A' or 'An' and names the age group as it looks in the photo "
    "(for example 'A young child with', 'A teenage girl with', 'An adult woman with'). Keep the apparent age of the person. "
    "In a second sentence starts with 'Wearing', describe the outfit and inferred lower-body clothing  (pants or shoes). "
    "In a third sentence, describe the overall mood based on facial expression, posture, and lighting. "
    "Ensure the character is holding nothing in their hands. "
    "Keep the total response concise (200–300 characters), focused, and free from unnecessary adjectives or embellishments."
)


def _so_far(story_so_far, last_question) -> str:
    scenes = [story_so_far] if isinstance(story_so_far, str) else list(story_so_far)
    return "Story so far:\n" + "\n".join(scenes) + f"\n\nPrevious question: {last_question}"


def intro(charName, genre, place) -> str:
    return f"""{COMMON}

Tell a story beginning in {place},
  inspired by {genre},
  following a main character named {charName},
  allowing for unexpected developments.

  Then, based on this story opening, return your answer in a JSON object with 4 fields: 
  1. intro (Korean): Write the story intro **only in Korean** (about 300 characters).
  2. question (Korean): Ask one narrative question in Korean only using simple vocabulary appropriate for elementary school children. The question must clearly connect to the story and directly relate to the three upcoming options. Avoid reusing sentence structures across different outputs.
  3. options (Korean): This is the answer options for the question you made right before. Give three choices in Korean only that are concrete objects or animals (e.g. things the character could choose, interact with, or follow). Each option must be a 2–3 word phrase (e.g. "파란 깃털", "작은 다람쥐", "나무 상자") that clearly answers or relates to the question. Do not use abstract ideas or verbs. Do not repeat options across outputs.
  4. illustration (English): {ILLUSTRATION}

  Important: Respond using the fields and languages exactly as instructed. Do not include explanations, formatting symbols, or extra text.
  """


def content(story_so_far, last_question, choice, charName, final_question) -> str:
    if final_question:
        question = "Ask one question to make the ending of the story. The question should not ask about things that have already been clearly described. It should help move the story forward."
    else:
        question = "Ask one narrative question (where, who, what, or why). The question should not ask about things that have already been clearly described. It should help move the story forward."
    return f"""{COMMON}

{_so_far(story_so_far, last_question)}

The user has selected "{choice}" as their answer to the previous question.
  Please continue the story in Korean, writing the next scene.
  This scene should naturally follow the previous events, and reflect the user’s choice within the flow of the narrative.
  It should also include the actions of the main character, {charName}, and their surrounding situation.

  Avoid flat or generic scenes such as “즐거운 시간을 보냈습니다.” or “즐거운 하루를 보냈습니다.” Include some form of tension, surprise, discovery, or a decision the character has to make.

  The question must not simply summarize or restate what happened in the story. Instead, it should help lead to a meaningful next event or choice.

  Then, based on this story opening:
  1. story : Write the story by continuing naturally from the previous events. (about 200 characters).
  2. question : {question}
  3. options : Give three one-word options related to that question.
  4. illustration (English): {ILLUSTRATION}

  Important: Respond using the fields and languages exactly as instructed. Do not include explanations, formatting symbols, or extra text. Respond in Korean only, except for the illustration field.
  """


def ending(story_so_far, last_question, choice, charName) -> str:
    return f"""{COMMON}

{_so_far(story_so_far, last_question)}

The user has selected "{choice}" as their answer to the previous question.
  Please continue the story in Korean, writing the final scene. It's the end of the story.
  The ending should feel complete and meaningful. It must leave a gentle emotional impact or convey a simple, age-appropriate moral for children between 7 and 9 years old.
  Avoid rushed conclusions or vague endings. Show what the main character experiences or learns through the final event.
  Write the ending in Korean, about 300 characters. Do not include any extra explanations or formatting.
  It should also include the actions of the main character, {charName}, and their surrounding situation.

  Return your answer in a JSON object with 2 fields:
  1. story (Korean): the ending.
  2. illustration (English): {ILLUSTRATION}
  """


def refine(paragraphs) -> str:
    return f"""{REFINE}

Return your answer in a JSON object with 3 fields:
1. paragraphs (Korean): the refined scenes, exactly {len(paragraphs)} items in the same order as the input.
2. title (Korean): a title for the whole story, 10 characters or fewer.
3. summary (Korean): one sentence that summarizes the whole story.

Scenes:
{json.dumps(list(paragraphs), ensure_ascii=False, indent=1)}
"""


def feature_card(has_character: bool) -> str:
    if has_character:
        images = (
            "Attached images: the first is a photo of the real person, the second is the approved storybook character of that person. "
            "Describe the outfit that the storybook character wears."
        )
    else:
        images = "Attached image: a photo of the real person."
    return f"""{FEATURE_CARD}

{images}

Output format (this overrides the sentence count and length above): return a JSON object with 1 field.
charLook (English): one or two sentences, 300 characters or fewer. The first starts with 'A' and follows the form 'A ... with ...', the second starts with 'Wearing'. Do not include a name.
"""
