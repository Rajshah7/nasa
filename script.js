// ==========================================
// NASA APOD API CONFIGURATION
// ==========================================

const API_URL = "https://science.nasa.gov/wp-json/wp/v2/apod-basic/";
const API_KEY = "DEMO_KEY";

const FIRST_APOD_DATE = "1995-06-16";


// ==========================================
// HTML ELEMENTS
// ==========================================

const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");

const currentImageContainer =
    document.getElementById("current-image-container");

const searchHistory =
    document.getElementById("search-history");


// Today's date in local time
function getTodayDate() {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

const today = getTodayDate();

searchInput.min = FIRST_APOD_DATE;
searchInput.max = today;


// ==========================================
// INITIALIZE PAGE
// ==========================================

document.addEventListener("DOMContentLoaded", function () {
    getCurrentImageOfTheDay();
    addSearchToHistory();
});


// ==========================================
// SEARCH FORM SUBMISSION
// ==========================================

searchForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const selectedDate = searchInput.value;

    if (!selectedDate) {
        alert("Please select a date.");
        return;
    }

    if (selectedDate < FIRST_APOD_DATE || selectedDate > today) {
        alert("Please select a valid date.");
        return;
    }

    getImageOfTheDay(selectedDate);
});


// ==========================================
// GET CURRENT IMAGE OF THE DAY
// ==========================================

async function getCurrentImageOfTheDay() {
    await fetchAndDisplayImage(today);
}


// ==========================================
// GET IMAGE OF SELECTED DATE
// ==========================================

async function getImageOfTheDay(date) {
    const success = await fetchAndDisplayImage(date);

    if (success) {
        saveSearch(date);
        addSearchToHistory();
    }
}


// ==========================================
// FETCH DATA FROM NASA
// ==========================================

async function fetchAndDisplayImage(date) {
    showLoading();

    try {
        const url = new URL(API_URL);

        url.searchParams.set("date", date);
        url.searchParams.set("api_key", API_KEY);

        console.log("Fetching NASA data:", url.toString());

        const response = await fetch(url);

        // Read response as text first to handle server errors.
        const responseText = await response.text();

        let data;

        try {
            data = JSON.parse(responseText);
        } catch {
            throw new Error(
                `NASA returned an invalid response. HTTP ${response.status}.`
            );
        }

        if (!response.ok) {
            throw new Error(
                data.message ||
                data.msg ||
                `Request failed: HTTP ${response.status}`
            );
        }

        // Support object or array responses.
        const apod = Array.isArray(data) ? data[0] : data;

        if (!apod || !apod.date || !apod.title) {
            console.error("Unexpected API response:", data);

            throw new Error(
                "The API response does not contain the expected picture data."
            );
        }

        console.log("NASA response:", apod);

        displayImage(apod);

        return true;

    } catch (error) {
        console.error("NASA API error:", error);
        showError(error.message);

        return false;
    }
}


// ==========================================
// DISPLAY PICTURE AND DETAILS
// ==========================================

function displayImage(data) {
    currentImageContainer.innerHTML = "";

    // Date heading
    const heading = document.createElement("h1");
    heading.textContent = `Picture On ${data.date}`;

    currentImageContainer.appendChild(heading);

    // Image or video
    if (data.media_type === "image" && (data.hdurl || data.url)) {
        const image = document.createElement("img");

        image.src = data.hdurl || data.url;
        image.alt = data.alt || data.title;
        image.loading = "lazy";

        image.onerror = function () {
            image.remove();

            const message = document.createElement("p");
            message.textContent = "Unable to load the image.";

            currentImageContainer.insertBefore(
                message,
                currentImageContainer.children[1] || null
            );
        };

        currentImageContainer.appendChild(image);

    } else if (data.media_type === "video") {
        const message = document.createElement("p");

        message.textContent = "Today's picture is a video.";

        currentImageContainer.appendChild(message);

        addNASAArticleLink(data);

    } else if (data.hdurl) {
        const image = document.createElement("img");

        image.src = data.hdurl;
        image.alt = data.alt || data.title;

        currentImageContainer.appendChild(image);

    } else {
        addNASAArticleLink(data);
    }

    // Title
    const title = document.createElement("h2");
    title.textContent = data.title;

    currentImageContainer.appendChild(title);

    // Explanation: render NASA's HTML formatting.
    const explanation = document.createElement("p");

    explanation.innerHTML = sanitizeNASAHtml(
        data.explanation || "No explanation available."
    );

    currentImageContainer.appendChild(explanation);

    // Credit
    const creditText = data.credit || data.copyright;

    if (creditText) {
        const credit = document.createElement("p");

        credit.innerHTML = sanitizeNASAHtml(creditText);

        currentImageContainer.appendChild(credit);
    }
}


// ==========================================
// NASA ARTICLE LINK
// ==========================================

function addNASAArticleLink(data) {
    const articleURL = data.permalink || data.url;

    if (!articleURL) return;

    try {
        const parsedURL = new URL(articleURL);

        if (
            parsedURL.protocol !== "https:" ||
            !(
                parsedURL.hostname === "nasa.gov" ||
                parsedURL.hostname.endsWith(".nasa.gov")
            )
        ) {
            return;
        }

        const link = document.createElement("a");

        link.href = parsedURL.href;
        link.textContent = "View on NASA's website";
        link.target = "_blank";
        link.rel = "noopener noreferrer";

        currentImageContainer.appendChild(link);

    } catch (error) {
        console.error("Invalid NASA URL:", error);
    }
}


// ==========================================
// CLEAN HTML FROM NASA RESPONSE
// ==========================================

function sanitizeNASAHtml(html) {
    const template = document.createElement("template");

    template.innerHTML = html;

    const allowedTags = [
        "P", "BR", "STRONG", "B", "EM", "I",
        "A", "UL", "OL", "LI", "SUB", "SUP"
    ];

    function cleanNode(parent) {
        [...parent.childNodes].forEach(function (node) {
            if (node.nodeType !== Node.ELEMENT_NODE) {
                if (node.nodeType !== Node.TEXT_NODE) {
                    node.remove();
                }

                return;
            }

            if (
                ["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED"]
                    .includes(node.tagName)
            ) {
                node.remove();
                return;
            }

            if (!allowedTags.includes(node.tagName)) {
                cleanNode(node);
                node.replaceWith(...node.childNodes);
                return;
            }

            const originalHref =
                node.tagName === "A"
                    ? node.getAttribute("href")
                    : null;

            [...node.attributes].forEach(function (attribute) {
                node.removeAttribute(attribute.name);
            });

            if (node.tagName === "A") {
                try {
                    const linkURL = new URL(originalHref);

                    if (linkURL.protocol !== "https:") {
                        node.replaceWith(...node.childNodes);
                        return;
                    }

                    node.setAttribute("href", linkURL.href);
                    node.setAttribute("target", "_blank");
                    node.setAttribute("rel", "noopener noreferrer");

                } catch {
                    node.replaceWith(...node.childNodes);
                    return;
                }
            }

            cleanNode(node);
        });
    }

    cleanNode(template.content);

    return template.innerHTML;
}


// ==========================================
// SAVE SEARCH TO LOCAL STORAGE
// ==========================================

function saveSearch(date) {
    let searches = [];

    try {
        searches = JSON.parse(
            localStorage.getItem("searches")
        ) || [];
    } catch {
        searches = [];
    }

    if (!searches.includes(date)) {
        searches.push(date);
    }

    localStorage.setItem(
        "searches",
        JSON.stringify(searches)
    );
}


// ==========================================
// DISPLAY PREVIOUS SEARCHES
// ==========================================

function addSearchToHistory() {
    let searches = [];

    try {
        searches = JSON.parse(
            localStorage.getItem("searches")
        ) || [];
    } catch {
        searches = [];
    }

    searchHistory.innerHTML = "";

    if (searches.length === 0) {
        const message = document.createElement("li");

        message.textContent = "No previous searches yet.";
        message.style.listStyle = "none";
        message.style.color = "#555";
        message.style.textDecoration = "none";
        message.style.cursor = "default";

        searchHistory.appendChild(message);

        return;
    }

    // Display newest searches first.
    searches.slice().reverse().forEach(function (date) {
        const listItem = document.createElement("li");

        listItem.textContent = date;

        listItem.addEventListener("click", function () {
            getImageOfTheDay(date);
        });

        searchHistory.appendChild(listItem);
    });
}


// ==========================================
// LOADING MESSAGE
// ==========================================

function showLoading() {
    currentImageContainer.innerHTML = `
        <h1>NASA Picture of the Day</h1>
        <p>Loading picture...</p>
    `;
}


// ==========================================
// ERROR MESSAGE
// ==========================================

function showError(message) {
    currentImageContainer.innerHTML = "";

    const heading = document.createElement("h1");
    heading.textContent = "Unable to Load Picture";

    const paragraph = document.createElement("p");
    paragraph.className = "error-message";
    paragraph.textContent = message;

    currentImageContainer.appendChild(heading);
    currentImageContainer.appendChild(paragraph);
}