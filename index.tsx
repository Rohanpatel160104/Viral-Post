import { GoogleGenAI, Modality, Type } from "@google/genai";

interface PostContent {
  image_prompt: string;
  header_text: string;
  subheader_text: string;
}

// --- Constants ---
const API_COUNT_STORAGE_KEY = 'nanoBananaApiCountData';
const CANVAS_TARGET_SIZE = 1080;

// --- Global State ---
let ai: GoogleGenAI;
let currentPostOptions: PostContent[] | null = null;
let selectedImageIndex = 0;
let imageGenerations: Map<number, { versions: string[], currentIndex: number }> = new Map();
let initialImagesGeneratedCount = 0;
let isInitialGeneration = false;

// --- Branding State ---
let brandingText: string = '';
let brandingTextColor: 'white' | 'black' = 'white';
let brandingLogoBase64: string | null = null;
let brandingSize: number = 8;
let brandingOpacity: number = 0.7;
let brandingPosition: { x: number, y: number } = { x: 20, y: 20 }; // Position on the 1080px canvas
let isDragging = false;
let dragStartOffset = { x: 0, y: 0 };

// --- Main form elements ---
const form = document.getElementById('idea-form') as HTMLFormElement;
const ideaInput = document.getElementById('idea-input') as HTMLInputElement;
const generateButton = document.getElementById('generate-button') as HTMLButtonElement;
const loadingIndicator = document.getElementById('loading-container') as HTMLDivElement;
const loadingText = document.getElementById('loading-text') as HTMLParagraphElement;
const apiCounter = document.getElementById('api-counter') as HTMLSpanElement;

// --- Branding Editor Elements ---
const brandingEditor = document.getElementById('branding-editor') as HTMLElement;
const brandingTextInput = document.getElementById('branding-text-input') as HTMLInputElement;
const brandingLogoInput = document.getElementById('branding-logo-input') as HTMLInputElement;
const brandingLogoLabel = document.getElementById('branding-logo-label') as HTMLLabelElement;
const brandingLogoPreviewWrapper = document.getElementById('branding-logo-preview-wrapper') as HTMLDivElement;
const brandingLogoPreview = document.getElementById('branding-logo-preview') as HTMLImageElement;
const brandingRemoveLogoButton = document.getElementById('branding-remove-logo-button') as HTMLButtonElement;
const brandingSizeSlider = document.getElementById('branding-size-slider') as HTMLInputElement;
const brandingOpacitySlider = document.getElementById('branding-opacity-slider') as HTMLInputElement;

// --- Output elements ---
const outputContainer = document.getElementById('results-container') as HTMLDivElement;
const captionContainer = document.getElementById('caption-container') as HTMLDivElement;
const postOptionsGrid = document.getElementById('post-options-grid') as HTMLDivElement;
const copyButton = document.getElementById('copy-button') as HTMLButtonElement;
const savePdfButton = document.getElementById('save-pdf-button') as HTMLButtonElement;
const captionTextEl = document.getElementById('caption-text') as HTMLDivElement;
const captionLoader = document.getElementById('caption-loader') as HTMLDivElement;
const imagePreviewContainer = document.getElementById('image-preview-container') as HTMLDivElement;
const previewImage = document.getElementById('preview-image') as HTMLImageElement;

// --- Preview Controls ---
const previewNavControls = document.querySelector('.preview-nav-controls') as HTMLDivElement;
const previewPrevBtn = document.getElementById('preview-prev-btn') as HTMLButtonElement;
const previewNextBtn = document.getElementById('preview-next-btn') as HTMLButtonElement;
const previewRegenBtn = document.getElementById('preview-regen-btn') as HTMLButtonElement;
const previewDownloadBtn = document.getElementById('preview-download-btn') as HTMLButtonElement;
const previewPromptBtn = document.getElementById('preview-prompt-btn') as HTMLButtonElement;
const previewEditBrandingBtn = document.getElementById('preview-edit-branding-btn') as HTMLButtonElement;

// --- Prompt Modal Elements ---
const promptModalOverlay = document.getElementById('prompt-modal-overlay') as HTMLDivElement;
const closePromptButton = document.getElementById('close-prompt-button') as HTMLButtonElement;
const promptModalHeaderInput = document.getElementById('prompt-modal-header-input') as HTMLInputElement;
const promptModalSubheaderInput = document.getElementById('prompt-modal-subheader-input') as HTMLInputElement;
const promptModalImagePromptInput = document.getElementById('prompt-modal-image-prompt-input') as HTMLTextAreaElement;
const regenerateWithPromptButton = document.getElementById('regenerate-with-prompt-button') as HTMLButtonElement;

// --- Branding Editor Modal Elements ---
const brandingEditorModalOverlay = document.getElementById('branding-editor-modal-overlay') as HTMLDivElement;
const closeBrandingEditorButton = document.getElementById('close-branding-editor-button') as HTMLButtonElement;
const saveBrandingPositionButton = document.getElementById('save-branding-position-button') as HTMLButtonElement;
const brandingEditorPreviewContainer = document.getElementById('branding-editor-preview-container') as HTMLDivElement;
const brandingEditorPreviewImage = document.getElementById('branding-editor-preview-image') as HTMLImageElement;
const brandingEditorOverlayElement = document.getElementById('branding-editor-overlay-element') as HTMLDivElement;

// --- Settings Modal Elements ---
const settingsButton = document.getElementById('settings-button') as HTMLButtonElement;
const settingsModalOverlay = document.getElementById('settings-modal-overlay') as HTMLDivElement;
const closeSettingsButton = document.getElementById('close-settings-button') as HTMLButtonElement;
const saveSettingsButton = document.getElementById('save-settings-button') as HTMLButtonElement;
const resetSettingsButton = document.getElementById('reset-settings-button') as HTMLButtonElement;
const imagePromptInput = document.getElementById('image-prompt-input') as HTMLTextAreaElement;
const captionPromptInput = document.getElementById('caption-prompt-input') as HTMLTextAreaElement;
const temperatureSlider = document.getElementById('temperature-slider') as HTMLInputElement;
const temperatureValue = document.getElementById('temperature-value') as HTMLSpanElement;

// --- Default Settings ---
const DEFAULT_IMAGE_PROMPT_SYSTEM_INSTRUCTION = `You are an expert Viral Instagram Post creator and art director. Your role is to generate the complete content for 5 DISTINCT post options.

**Your Primary Goal: CREATE 5 SCROLL-STOPPING IMAGE CONCEPTS**
You must conceptualize five unique, visually striking image options. For each option, you must define:
- **Color Palette:** A cohesive set of colors (e.g., "vibrant pastels," "monochromatic black and white").
- **Style:** A consistent artistic style (e.g., "minimalist line art," "glossy 3D render," "cinematic photorealistic").
- **Composition:** A clear focal point and layout that leaves space for text.
- **Tone:** A specific mood (e.g., "inspirational and uplifting," "bold and energetic").

**Your Task:**
1.  Receive a topic from the user.
2.  Brainstorm 5 DIVERSE visual themes (colors, styles, tones, compositions).
3.  Generate an array of 5 JSON objects. Each object must contain:
    a.  \`image_prompt\`: A visually descriptive prompt for the AI image generator, incorporating the theme.
    b.  \`header_text\`: A short, punchy headline to be overlaid on the image.
    c.  \`subheader_text\`: A brief explanatory sub-headline or call-to-action for the image.

**Rules for Output:**
-   Return a single JSON array.
-   The JSON array must contain exactly 5 objects.
-   Each object must have three string keys: "image_prompt", "header_text", and "subheader_text".
-   Ensure the 5 options are significantly different from each other.

---
**## Example Application ##**

**If the User Topic is:** "The importance of daily hydration"

**Your JSON Output for that Example:**
[
  {
    "image_prompt": "A hyper-realistic, glossy 3D render of a crystal clear glass of water with sparkling condensation droplets. An orange slice rests on the rim. The background is a clean, minimalist gradient of cool blue to white.",
    "header_text": "DRINK MORE WATER",
    "subheader_text": "Your body will thank you."
  },
  {
    "image_prompt": "Minimalist line art illustration of a stylized water droplet character running a marathon. The color palette is simple two-tone blue on an off-white background.",
    "header_text": "FUEL YOUR GOALS",
    "subheader_text": "Hydration is key."
  },
  {
    "image_prompt": "A dramatic, cinematic photo of a person's hand reaching for a bottle of water in a desert. The lighting is golden hour, casting long shadows. Focus is on the bottle.",
    "header_text": "QUENCH YOUR THIRST",
    "subheader_text": "Don't wait until it's too late."
  },
  {
    "image_prompt": "A vibrant, colorful flat-lay composition of various fruits and vegetables known for high water content (watermelon, cucumber, strawberries) arranged in a beautiful pattern.",
    "header_text": "EAT YOUR WATER",
    "subheader_text": "Hydration comes from food too."
  },
  {
    "image_prompt": "A sleek, futuristic infographic design showing the human body with glowing blue lines indicating water flow and statistics about hydration benefits. Dark mode, neon blue and white text.",
    "header_text": "UNLOCK PEAK PERFORMANCE",
    "subheader_text": "It all starts with H2O."
  }
]
---`;
const DEFAULT_CAPTION_SYSTEM_INSTRUCTION = `You are a world-class Instagram copywriter. Your goal is to write a viral, engaging caption for a single image post.
You will be given the content of the post.
Your caption MUST:
-   Be between 50-150 words.
-   Start with a strong, scroll-stopping hook.
-   Provide value and context for the image.
-   End with a clear call-to-action (e.g., asking a question, asking to save/share).
-   Include 5-10 relevant, high-traffic hashtags.
-   Have a professional yet conversational tone.
-   Be formatted with line breaks for readability.`;


// --- API Count Management ---
function getISTDateString(): string {
    const now = new Date();
    // en-CA format is YYYY-MM-DD which is perfect for comparison
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(now);
}

function getApiCountData(): { count: number; lastReset: string } {
    const storedData = localStorage.getItem(API_COUNT_STORAGE_KEY);
    const todayIST = getISTDateString();
    if (storedData) {
        try {
            const data = JSON.parse(storedData);
            // Check if data has the expected shape and lastReset is the current day in IST
            if (data && typeof data.count === 'number' && data.lastReset === todayIST) {
                return data;
            }
        } catch (e) {
            console.error("Error parsing API count data from localStorage", e);
            // If parsing fails, fall through to reset
        }
    }
    // If no data, data is malformed, or date is old, reset
    const newData = { count: 0, lastReset: todayIST };
    localStorage.setItem(API_COUNT_STORAGE_KEY, JSON.stringify(newData));
    return newData;
}

function incrementApiCount(): void {
    const data = getApiCountData();
    data.count++;
    localStorage.setItem(API_COUNT_STORAGE_KEY, JSON.stringify(data));
}


// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    loadSettings();
    updateApiCounterDisplay();
    initializeBrandingControls();
    initializeBrandingEditorModal();
});

form.addEventListener('submit', handleSubmit);
copyButton.addEventListener('click', handleCopyCaption);
savePdfButton.addEventListener('click', handleSaveAsPdf);

// Preview Controls Listeners
previewPrevBtn.addEventListener('click', (e) => handleNavigateVersion(e, selectedImageIndex, -1));
previewNextBtn.addEventListener('click', (e) => handleNavigateVersion(e, selectedImageIndex, 1));
previewRegenBtn.addEventListener('click', (e) => handleRegenerateImage(e, selectedImageIndex));
previewDownloadBtn.addEventListener('click', handlePreviewDownload);
previewPromptBtn.addEventListener('click', handleShowPrompt);
previewEditBrandingBtn.addEventListener('click', openBrandingEditorModal);

// Prompt Modal Listeners
closePromptButton.addEventListener('click', closePromptModal);
promptModalOverlay.addEventListener('click', (e) => {
    if (e.target === promptModalOverlay) {
        closePromptModal();
    }
});
regenerateWithPromptButton.addEventListener('click', handleRegenerateWithEditedPrompt);

// Branding Editor Modal Listeners
closeBrandingEditorButton.addEventListener('click', closeBrandingEditorModal);
brandingEditorModalOverlay.addEventListener('click', (e) => {
    if (e.target === brandingEditorModalOverlay) {
        closeBrandingEditorModal();
    }
});
saveBrandingPositionButton.addEventListener('click', handleSaveBrandingPosition);


// Settings Modal Listeners
settingsButton.addEventListener('click', openSettings);
closeSettingsButton.addEventListener('click', closeSettings);
settingsModalOverlay.addEventListener('click', (e) => {
    if (e.target === settingsModalOverlay) {
        closeSettings();
    }
});
saveSettingsButton.addEventListener('click', saveSettings);
resetSettingsButton.addEventListener('click', resetSettingsToDefaults);
temperatureSlider.addEventListener('input', () => {
    temperatureValue.textContent = temperatureSlider.value;
});

// --- Main Functions ---
function checkInitialGenerationComplete() {
    if (isInitialGeneration) {
        initialImagesGeneratedCount++;
        if (initialImagesGeneratedCount >= 5) {
            isInitialGeneration = false;
        }
    }
}

async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!ideaInput.value.trim()) {
        alert("Please enter a topic or idea.");
        return;
    }

    // Reset state and UI for a new generation
    currentPostOptions = null;
    selectedImageIndex = 0;
    imageGenerations.clear();
    initialImagesGeneratedCount = 0;
    isInitialGeneration = true;
    updateApiCounterDisplay();
    outputContainer.classList.add('hidden');
    brandingEditor.classList.add('hidden');
    imagePreviewContainer.classList.add('hidden');
    copyButton.disabled = true;
    savePdfButton.disabled = true;
    captionTextEl.innerHTML = `Select an image above to see the caption.`;

    try {
        setLoadingState(true, 'Step 1/2: Crafting 5 viral concepts...');
        const postContentArray = await generatePostContent(ideaInput.value);
        currentPostOptions = postContentArray;

        // Immediately show the output container with skeleton loaders
        setupImagePlaceholders();
        outputContainer.classList.remove('hidden');
        brandingEditor.classList.remove('hidden');


        setLoadingState(true, 'Step 2/2: Generating visuals & caption...');

        // Fire and forget image generation. `generateImage` will update the UI for each.
        currentPostOptions.forEach((content, index) => generateImage(content, index));
        
        // Generate and wait for the caption for the first image
        const caption = await generateCaption(currentPostOptions[0]);
        displayCaption(caption);
        
        // Enable buttons once caption is ready
        copyButton.disabled = false;
        savePdfButton.disabled = false;


    } catch (error) {
        console.error("An error occurred:", error);
        alert(`An error occurred: ${error.message}`);
    } finally {
        // Hide the main loading spinner. Individual skeletons will remain.
        setLoadingState(false);
    }
}


// --- API Call Functions ---
async function generatePostContent(topic: string): Promise<PostContent[]> {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: `Apply the framework to this topic: "${topic}"`,
        config: {
            temperature: parseFloat(localStorage.getItem('temperature') || '0.9'),
            systemInstruction: localStorage.getItem('imagePrompt') || DEFAULT_IMAGE_PROMPT_SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        image_prompt: { type: Type.STRING },
                        header_text: { type: Type.STRING },
                        subheader_text: { type: Type.STRING },
                    },
                    required: ['image_prompt', 'header_text', 'subheader_text'],
                }
            },
            thinkingConfig: { thinkingBudget: 32768 },
        },
    });
    const json = JSON.parse(response.text);
    if (!Array.isArray(json) || json.length === 0) {
        throw new Error("AI failed to generate post content options.");
    }
    return json;
}

async function generateCaption(postContent: PostContent): Promise<string> {
    const promptText = `Post Content:\n- Visuals: ${postContent.image_prompt}\n- Text: "${postContent.header_text} - ${postContent.subheader_text}"`;
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: promptText,
        config: {
            temperature: parseFloat(localStorage.getItem('temperature') || '0.9'),
            systemInstruction: localStorage.getItem('captionPrompt') || DEFAULT_CAPTION_SYSTEM_INSTRUCTION,
            thinkingConfig: { thinkingBudget: 32768 },
        },
    });
    return response.text.trim();
}

async function generateImage(postContent: PostContent, index: number): Promise<void> {
    incrementApiCount();
    updateApiCounterDisplay();
    const combinedPrompt = `${postContent.image_prompt}. The image must prominently feature the following text, styled beautifully and legibly. Header: "${postContent.header_text}". Subheader: "${postContent.subheader_text}".`;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [{ text: combinedPrompt }]
            },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });
        
        const imagePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);

        if (imagePart?.inlineData?.data) {
            const base64Image = imagePart.inlineData.data;
            await displayImage(base64Image, index);
        } else {
            const finishReason = response.candidates?.[0]?.finishReason;
            const safetyRatings = response.candidates?.[0]?.safetyRatings;
            console.error(`No image data received for option ${index + 1}.`, { finishReason, safetyRatings, response });
            
            let errorMessage = 'No image data';
            if (finishReason === 'SAFETY') {
                errorMessage = 'Blocked by safety filters. Try editing the prompt.';
            } else if (finishReason === 'NO_IMAGE') {
                errorMessage = 'Generation failed. Please try again.';
            }
            displayError(errorMessage, index);
            checkInitialGenerationComplete();
        }
    } catch (error) {
        console.error(`Error generating image ${index + 1}:`, error);
        displayError('API Error', index);
        checkInitialGenerationComplete();
    }
}


// --- UI Functions ---
function setLoadingState(isLoading: boolean, message: string = '') {
    if (isLoading) {
        loadingIndicator.classList.remove('hidden');
        loadingText.textContent = message;
        generateButton.disabled = true;
        generateButton.querySelector('span')!.textContent = 'Generating...';
    } else {
        loadingIndicator.classList.add('hidden');
        generateButton.disabled = false;
        generateButton.querySelector('span')!.textContent = 'Generate';
    }
}

function displayCaption(caption: string) {
    // Basic markdown-to-HTML conversion
    let html = caption.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\n/g, '<br>');
    captionTextEl.innerHTML = html;
}

function setupImagePlaceholders() {
    postOptionsGrid.innerHTML = '';
    for (let i = 0; i < 5; i++) {
        const wrapper = document.createElement('div');
        wrapper.className = 'post-image-wrapper';
        wrapper.dataset.index = i.toString();
        
        const skeleton = document.createElement('div');
        skeleton.className = 'skeleton-loader';
        skeleton.setAttribute('role', 'status');
        skeleton.innerHTML = `
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 20">
                <path d="M5 5V.13a2.96 2.96 0 0 0-1.293.749L.879 3.707A2.98 2.98 0 0 0 .13 5H5Z"/>
                <path d="M14.066 0H7v5a2 2 0 0 1-2 2H0v11a1.97 1.97 0 0 0 1.934 2h12.132A1.97 1.97 0 0 0 16 18V2a1.97 1.97 0 0 0-1.934-2ZM9 13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2Zm4 .382a1 1 0 0 1-1.447.894L10 13v-2l1.553-1.276a1 1 0 0 1 1.447.894v2.764Z"/>
            </svg>
            <span class="sr-only">Loading...</span>`;
        
        wrapper.appendChild(skeleton);
        wrapper.addEventListener('click', () => handleImageSelect(i));
        postOptionsGrid.appendChild(wrapper);
    }
    // Select the first one by default
    postOptionsGrid.children[0]?.classList.add('selected');
}

async function renderImageThumbnail(index: number) {
    const container = postOptionsGrid.querySelector(`[data-index="${index}"]`) as HTMLDivElement;
    const imageData = imageGenerations.get(index);

    if (!container || !imageData || !currentPostOptions) return;

    const { versions, currentIndex } = imageData;
    const originalImageSrc = versions[currentIndex];
    const processedImageSrc = await processImage(originalImageSrc);

    // Preload and decode the image in memory to prevent flicker
    const img = new Image();
    img.src = processedImageSrc;
    img.alt = `Generated image for: ${currentPostOptions?.[index]?.header_text}`;
    try {
        await img.decode();
    } catch (e) {
        console.error(`Image decoding failed for thumbnail ${index}:`, e);
        // If decoding fails, we can still try to display it and let the browser handle it.
    }

    // Now that the image is ready, update the DOM
    container.innerHTML = ''; // Clear spinner/skeleton content
    container.appendChild(img);

    // Add overlay with controls
    const overlay = document.createElement('div');
    overlay.className = 'image-overlay';

    // Add navigation if multiple versions exist
    if (versions.length > 1) {
        const nav = document.createElement('div');
        nav.className = 'thumbnail-nav';

        const prevBtn = document.createElement('button');
        prevBtn.className = 'nav-btn';
        prevBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>`;
        prevBtn.addEventListener('click', (e) => handleNavigateVersion(e, index, -1));

        const nextBtn = document.createElement('button');
        nextBtn.className = 'nav-btn';
        nextBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
        nextBtn.addEventListener('click', (e) => handleNavigateVersion(e, index, 1));
        
        nav.appendChild(prevBtn);
        nav.appendChild(nextBtn);
        overlay.appendChild(nav);
        
        const versionCounter = document.createElement('div');
        versionCounter.className = 'version-counter';
        versionCounter.textContent = `${currentIndex + 1} / ${versions.length}`;
        container.appendChild(versionCounter);
    }
    
    container.appendChild(overlay);

    // If this is the first image, set it as the initial preview
    if (index === 0 && versions.length === 1 && isInitialGeneration) {
        await rerenderMainPreview();
    }
}

async function displayImage(base64Image: string, index: number) {
    const originalSrc = `data:image/png;base64,${base64Image}`;

    if (!imageGenerations.has(index)) {
        imageGenerations.set(index, { versions: [], currentIndex: -1 });
    }
    const imageData = imageGenerations.get(index)!;
    imageData.versions.push(originalSrc);
    imageData.currentIndex = imageData.versions.length - 1;

    await renderImageThumbnail(index);
    
    checkInitialGenerationComplete();

    if (index === selectedImageIndex) {
        await rerenderMainPreview();
    }
}


function displayError(message: string, index: number) {
    const container = postOptionsGrid.querySelector(`[data-index="${index}"]`);
    if (container) {
        container.innerHTML = `<div class="error-message">
            <span>${message}</span>
            <button class="regen-btn-small" title="Regenerate Image">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
            </button>
        </div>`;
        container.querySelector('.regen-btn-small')?.addEventListener('click', (e) => handleRegenerateImage(e as MouseEvent, index));
    }
}

async function rerenderMainPreview() {
    if (!previewImage || !imagePreviewContainer || !currentPostOptions) return;
    
    const imageData = imageGenerations.get(selectedImageIndex);
    if (!imageData || imageData.versions.length === 0) {
        imagePreviewContainer.classList.add('hidden');
        return;
    };
    
    const originalSrc = imageData.versions[imageData.currentIndex];
    const altText = `Preview for: ${currentPostOptions[selectedImageIndex].header_text}`;
    const processedSrc = await processImage(originalSrc);

    // Preload and decode the new preview image before showing it to prevent flicker
    const img = new Image();
    img.src = processedSrc;
    try {
        await img.decode();
    } catch(e) {
        console.error("Image decoding failed for main preview:", e);
    }
    
    // Now swap it in
    previewImage.src = img.src;
    previewImage.alt = altText;
    imagePreviewContainer.classList.remove('hidden');

    // Update nav controls
    if (imageData.versions.length > 1) {
        previewNavControls.classList.remove('hidden');
    } else {
        previewNavControls.classList.add('hidden');
    }
}

async function handleImageSelect(index: number) {
    if (index === selectedImageIndex || !currentPostOptions) return;

    // Update selected state
    const previouslySelected = postOptionsGrid.querySelector(`[data-index="${selectedImageIndex}"]`);
    previouslySelected?.classList.remove('selected');
    const newlySelected = postOptionsGrid.querySelector(`[data-index="${index}"]`);
    newlySelected?.classList.add('selected');
    
    selectedImageIndex = index;

    await rerenderMainPreview();

    // Fetch new caption
    captionLoader.classList.remove('hidden');
    copyButton.disabled = true;
    savePdfButton.disabled = true;
    try {
        const newCaption = await generateCaption(currentPostOptions[index]);
        displayCaption(newCaption);
    } catch (error) {
        captionTextEl.innerHTML = `<span class="error-message">Failed to generate caption.</span>`;
        console.error("Failed to generate new caption:", error);
    } finally {
        captionLoader.classList.add('hidden');
        copyButton.disabled = false;
        savePdfButton.disabled = false;
    }
}

async function handleRegenerateImage(e: MouseEvent, index: number) {
    e.stopPropagation();
    if (!currentPostOptions) return;

    const container = postOptionsGrid.querySelector(`[data-index="${index}"]`) as HTMLDivElement;
    if (container) {
        const loader = document.createElement('div');
        loader.className = 'thumbnail-loader';
        loader.innerHTML = `<div class="spinner"></div>`;
        container.appendChild(loader);
    }

    await generateImage(currentPostOptions[index], index);
}

async function handleNavigateVersion(e: MouseEvent, index: number, direction: number) {
    e.stopPropagation();
    const imageData = imageGenerations.get(index);
    if (!imageData || !currentPostOptions) return;

    let newIndex = imageData.currentIndex + direction;
    if (newIndex < 0) newIndex = imageData.versions.length - 1;
    if (newIndex >= imageData.versions.length) newIndex = 0;
    
    imageData.currentIndex = newIndex;
    await renderImageThumbnail(index);

    if (index === selectedImageIndex) {
         await rerenderMainPreview();
    }
}


// --- Preview and Prompt Modal Functions ---

async function handlePreviewDownload() {
    if (!currentPostOptions) return;
    const imageData = imageGenerations.get(selectedImageIndex);
    if (!imageData) return;

    const originalImageSrc = imageData.versions[imageData.currentIndex];
    const processedImageSrc = await processImage(originalImageSrc);

    const postContent = currentPostOptions[selectedImageIndex];
    handleDownloadImage(processedImageSrc, postContent);
}

function handleShowPrompt() {
    if (!currentPostOptions) return;
    const postContent = currentPostOptions[selectedImageIndex];
    promptModalHeaderInput.value = postContent.header_text;
    promptModalSubheaderInput.value = postContent.subheader_text;
    promptModalImagePromptInput.value = postContent.image_prompt;
    promptModalOverlay.classList.remove('hidden');
}

async function handleRegenerateWithEditedPrompt() {
    if (!currentPostOptions) return;

    const editedPostContent: PostContent = {
        header_text: promptModalHeaderInput.value.trim(),
        subheader_text: promptModalSubheaderInput.value.trim(),
        image_prompt: promptModalImagePromptInput.value.trim(),
    };

    currentPostOptions[selectedImageIndex] = editedPostContent;

    closePromptModal();

    const container = postOptionsGrid.querySelector(`[data-index="${selectedImageIndex}"]`) as HTMLDivElement;
    if (container) {
        const loader = document.createElement('div');
        loader.className = 'thumbnail-loader';
        loader.innerHTML = `<div class="spinner"></div>`;
        container.appendChild(loader);
    }
    
    await generateImage(editedPostContent, selectedImageIndex);
}

function closePromptModal() {
    promptModalOverlay.classList.add('hidden');
}


// --- Settings Functions ---
function openSettings() {
    settingsModalOverlay.classList.remove('hidden');
}

function closeSettings() {
    settingsModalOverlay.classList.add('hidden');
}

function loadSettings() {
    const imagePrompt = localStorage.getItem('imagePrompt') || DEFAULT_IMAGE_PROMPT_SYSTEM_INSTRUCTION;
    const captionPrompt = localStorage.getItem('captionPrompt') || DEFAULT_CAPTION_SYSTEM_INSTRUCTION;
    const temperature = localStorage.getItem('temperature') || '0.9';

    imagePromptInput.value = imagePrompt;
    captionPromptInput.value = captionPrompt;
    temperatureSlider.value = temperature;
    temperatureValue.textContent = temperature;
}

function saveSettings() {
    localStorage.setItem('imagePrompt', imagePromptInput.value);
    localStorage.setItem('captionPrompt', captionPromptInput.value);
    localStorage.setItem('temperature', temperatureSlider.value);
    closeSettings();
    alert('Settings saved!');
}

function resetSettingsToDefaults() {
    if (confirm('Are you sure you want to reset all settings to their defaults?')) {
        localStorage.removeItem('imagePrompt');
        localStorage.removeItem('captionPrompt');
        localStorage.removeItem('temperature');
        loadSettings(); // Reload defaults into the form
        alert('Settings have been reset to default.');
    }
}


// --- Utility Functions ---
function handleCopyCaption() {
    if (captionTextEl) {
        const textToCopy = captionTextEl.innerText;
        navigator.clipboard.writeText(textToCopy).then(() => {
            const copyButtonSpan = copyButton.querySelector('span');
            if (copyButtonSpan) {
                copyButtonSpan.textContent = 'Copied!';
                setTimeout(() => {
                    copyButtonSpan.textContent = 'Copy';
                }, 2000);
            }
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            alert('Failed to copy caption.');
        });
    }
}

function handleDownloadImage(imageSrc: string, postContent: PostContent) {
    if (!imageSrc || !postContent) {
        alert("Image is not available for download.");
        return;
    }

    const link = document.createElement('a');
    link.href = imageSrc;
    
    const title = postContent.header_text?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'viral_post';
    link.download = `${title}.png`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function handleSaveAsPdf() {
    const selectedImageData = imageGenerations.get(selectedImageIndex);
    if (!selectedImageData || !captionTextEl.innerText || !currentPostOptions) {
        alert('Please select an image and generate a caption first.');
        return;
    }

    const originalImageSrc = selectedImageData.versions[selectedImageData.currentIndex];
    const imageSrc = await processImage(originalImageSrc);
    const captionHtml = captionTextEl.innerHTML;
    const topic = ideaInput.value;
    const header = currentPostOptions[selectedImageIndex].header_text;

    const printContent = `
        <div id="print-container">
            <h1>Viral Post</h1>
            <p><strong>Topic:</strong> ${topic}</p>
            <p><strong>Header:</strong> ${header}</p>
            <img src="${imageSrc}" alt="Generated Post Image" />
            <h2>Caption</h2>
            <div class="caption-content">${captionHtml}</div>
        </div>
    `;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("Could not open print window. Please disable your pop-up blocker.");
        return;
    }

    printWindow.document.write('<html><head><title>Viral Post - Save as PDF</title>');
    printWindow.document.write(`
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 2rem; color: #333; }
            #print-container { max-width: 700px; margin: auto; }
            h1, h2 { border-bottom: 2px solid #eee; padding-bottom: 0.5rem; color: #000; }
            h1 { font-size: 2rem; }
            h2 { font-size: 1.5rem; margin-top: 2rem; }
            img { max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 8px; margin: 1.5rem 0; }
            .caption-content { white-space: pre-wrap; word-wrap: break-word; line-height: 1.6; font-size: 1.1rem; }
            strong { color: #000; }
            p { font-size: 1.1rem; }
        </style>
    `);
    printWindow.document.write('</head><body>');
    printWindow.document.write(printContent);
    printWindow.document.write('</body></html>');
    
    const img = printWindow.document.querySelector('img');

    const doPrint = () => {
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        printWindow.close();
    };

    if (img.complete) {
        doPrint();
    } else {
        img.onload = doPrint;
    }
}

function updateApiCounterDisplay() {
    if (apiCounter) {
        const { count } = getApiCountData();
        apiCounter.textContent = count.toString();
    }
}

// --- Branding & Image Processing ---

async function handleBrandingChange() {
    await rerenderAllThumbnails();
    await rerenderMainPreview();
}

function initializeBrandingControls() {
    brandingTextInput.addEventListener('input', () => {
        brandingText = brandingTextInput.value;
        if (brandingText) {
            brandingLogoBase64 = null; // Text overrides logo
            clearLogoSelection();
        }
        handleBrandingChange();
    });

    const brandingColorRadios = document.querySelectorAll<HTMLInputElement>('input[name="branding-color"]');
    brandingColorRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            const checkedRadio = document.querySelector<HTMLInputElement>('input[name="branding-color"]:checked');
            if (checkedRadio) {
                brandingTextColor = checkedRadio.value as 'white' | 'black';
                handleBrandingChange();
            }
        });
    });

    brandingLogoInput.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                brandingLogoBase64 = event.target?.result as string;
                brandingText = ''; // Logo overrides text
                brandingTextInput.value = '';
                
                brandingLogoPreview.src = brandingLogoBase64;
                brandingLogoPreviewWrapper.classList.remove('hidden');
                brandingLogoLabel.classList.add('hidden');
                
                handleBrandingChange();
            };
            reader.readAsDataURL(file);
        }
    });

    brandingRemoveLogoButton.addEventListener('click', () => {
        brandingLogoBase64 = null;
        clearLogoSelection();
        handleBrandingChange();
    });

    brandingSizeSlider.addEventListener('input', () => {
        brandingSize = parseInt(brandingSizeSlider.value, 10);
        handleBrandingChange();
    });

    brandingOpacitySlider.addEventListener('input', () => {
        brandingOpacity = parseFloat(brandingOpacitySlider.value);
        handleBrandingChange();
    });
}

function initializeBrandingEditorModal() {
    brandingEditorOverlayElement.addEventListener('mousedown', (e) => {
        e.preventDefault();
        isDragging = true;
        const rect = brandingEditorOverlayElement.getBoundingClientRect();
        
        dragStartOffset.x = e.clientX - rect.left;
        dragStartOffset.y = e.clientY - rect.top;

        brandingEditorOverlayElement.style.cursor = 'grabbing';
        document.body.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const parentRect = brandingEditorPreviewContainer.getBoundingClientRect();
        let newX = e.clientX - parentRect.left - dragStartOffset.x;
        let newY = e.clientY - parentRect.top - dragStartOffset.y;

        newX = Math.max(0, Math.min(newX, parentRect.width - brandingEditorOverlayElement.offsetWidth));
        newY = Math.max(0, Math.min(newY, parentRect.height - brandingEditorOverlayElement.offsetHeight));
        
        brandingPosition.x = (newX / parentRect.width) * CANVAS_TARGET_SIZE;
        brandingPosition.y = (newY / parentRect.height) * CANVAS_TARGET_SIZE;

        updateBrandingEditorOverlay();
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            brandingEditorOverlayElement.style.cursor = 'move';
            document.body.style.cursor = 'default';
        }
    });
}

function openBrandingEditorModal() {
    const imageData = imageGenerations.get(selectedImageIndex);
    if (!imageData || imageData.versions.length === 0) {
        alert("Please select an image to add branding to.");
        return;
    }
    const originalSrc = imageData.versions[imageData.currentIndex];

    const setupEditor = () => {
        // This function is called once the image is loaded,
        // ensuring the container has the correct dimensions.
        updateBrandingEditorOverlay();
    };

    // Reset previous onload handler to avoid multiple triggers
    brandingEditorPreviewImage.onload = null;
    // Set the new handler
    brandingEditorPreviewImage.onload = setupEditor;

    // Set the src to trigger loading
    brandingEditorPreviewImage.src = originalSrc;
    
    // If the image is already cached by the browser, the 'load' event might not fire.
    // We check the 'complete' property to handle this case and manually trigger the setup.
    if (brandingEditorPreviewImage.complete) {
        setupEditor();
    }
    
    // Make the modal visible
    brandingEditorModalOverlay.classList.remove('hidden');
}

function closeBrandingEditorModal() {
    brandingEditorModalOverlay.classList.add('hidden');
}

async function handleSaveBrandingPosition() {
    closeBrandingEditorModal();
    // The position is already updated by the drag handler, now apply it everywhere
    await rerenderAllThumbnails();
    await rerenderMainPreview();
}

function clearLogoSelection() {
    brandingLogoInput.value = '';
    brandingLogoPreviewWrapper.classList.add('hidden');
    brandingLogoLabel.classList.remove('hidden');
}

function updateBrandingEditorOverlay() {
    if (!brandingLogoBase64 && !brandingText) {
        brandingEditorOverlayElement.classList.add('hidden');
        return;
    }
    
    brandingEditorOverlayElement.classList.remove('hidden');
    brandingEditorOverlayElement.innerHTML = '';
    
    let element: HTMLImageElement | HTMLSpanElement;

    const previewHeight = brandingEditorPreviewContainer.clientHeight;

    if (previewHeight === 0) {
        // If container has no height yet, don't try to render.
        // This can happen if the modal is not fully rendered.
        return;
    }

    if (brandingLogoBase64) {
        const img = document.createElement('img');
        img.src = brandingLogoBase64;
        element = img;
        const logoHeight = previewHeight * (brandingSize / 100);
        element.style.height = `${logoHeight}px`;
        element.style.width = 'auto';
    } else { // brandingText
        const span = document.createElement('span');
        span.textContent = brandingText;
        element = span;
        const fontSize = (previewHeight / 1080) * (brandingSize * 2.5);
        element.style.fontSize = `${fontSize}px`;
        element.style.color = brandingTextColor;
        if (brandingTextColor === 'white') {
            element.style.textShadow = '1px 1px 3px rgba(0,0,0,0.7)';
        } else {
            element.style.textShadow = '1px 1px 3px rgba(255,255,255,0.7)';
        }
    }
    
    brandingEditorOverlayElement.appendChild(element);
    brandingEditorOverlayElement.style.opacity = brandingOpacity.toString();
    
    const parentRect = brandingEditorPreviewContainer.getBoundingClientRect();
    if(parentRect.width > 0) {
        const displayX = (brandingPosition.x / CANVAS_TARGET_SIZE) * parentRect.width;
        const displayY = (brandingPosition.y / CANVAS_TARGET_SIZE) * parentRect.height;
        brandingEditorOverlayElement.style.left = `${displayX}px`;
        brandingEditorOverlayElement.style.top = `${displayY}px`;
    }
}


async function processImage(originalSrc: string): Promise<string> {
    const hasBranding = brandingLogoBase64 || brandingText.trim();

    if (!hasBranding) {
        return originalSrc;
    }

    return new Promise((resolve, reject) => {
        const sourceImage = new Image();
        sourceImage.crossOrigin = "anonymous";
        sourceImage.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = CANVAS_TARGET_SIZE;
            canvas.height = CANVAS_TARGET_SIZE;

            if (!ctx) {
                return resolve(originalSrc);
            }

            ctx.drawImage(sourceImage, 0, 0, CANVAS_TARGET_SIZE, CANVAS_TARGET_SIZE);
            ctx.globalAlpha = brandingOpacity;

            const finalize = () => resolve(canvas.toDataURL('image/png'));

            if (brandingLogoBase64) {
                const logoImage = new Image();
                logoImage.onload = () => {
                    const logoHeight = CANVAS_TARGET_SIZE * (brandingSize / 100);
                    const scale = logoHeight / logoImage.height;
                    const logoWidth = logoImage.width * scale;
                    ctx.drawImage(logoImage, brandingPosition.x, brandingPosition.y, logoWidth, logoHeight);
                    finalize();
                };
                logoImage.onerror = () => finalize();
                logoImage.src = brandingLogoBase64;
            } else if (brandingText.trim()) {
                const fontSize = brandingSize * 2.5;
                ctx.font = `600 ${fontSize}px Inter, sans-serif`;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';

                // Use a drop shadow for better legibility
                if (brandingTextColor === 'white') {
                    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
                    ctx.fillStyle = 'rgba(255, 255, 255, 1)';
                } else { // black
                    ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
                    ctx.fillStyle = 'rgba(0, 0, 0, 1)';
                }
                ctx.shadowOffsetX = fontSize / 20;
                ctx.shadowOffsetY = fontSize / 20;
                ctx.shadowBlur = fontSize / 10;

                ctx.fillText(brandingText, brandingPosition.x, brandingPosition.y);
                
                // Reset shadow properties for subsequent draws
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;

                finalize();
            } else {
                 finalize();
            }
        };
        sourceImage.onerror = () => reject(new Error("Image load error for processing"));
        sourceImage.src = originalSrc;
    });
}

async function rerenderAllThumbnails() {
    if (imageGenerations.size === 0) return;
    const renderPromises = Array.from(imageGenerations.keys()).map(renderImageThumbnail);
    await Promise.all(renderPromises);
}
