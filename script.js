// ==UserScript==
// @name         NIGGA RACING
// @namespace    http://your.namespace
// @version      0.1
// @description  Replaces all cars with Nissan Altima's (jk)
// @match        https://www.torn.com/loader.php?sid=racing*
// @author       Lollipop :)
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';

    // ------------------------------------------------------------------------
    // Toggle this flag to turn all debug logs on/off.
    // ------------------------------------------------------------------------
    const DEBUG_MODE = true;

    // ------------------------------------------------------------------------
    // Helper functions for unified logging (honor the debug flag).
    // ------------------------------------------------------------------------
    function debugLog(...args) {
        if (DEBUG_MODE) {
            console.log(...args);
        }
    }
    function debugWarn(...args) {
        if (DEBUG_MODE) {
            console.warn(...args);
        }
    }
    function debugError(...args) {
        if (DEBUG_MODE) {
            console.error(...args);
        }
    }

    // ------------------------------------------------------------------------
    // If you want certain errors to show *even if* DEBUG_MODE is false
    // you can skip the if-check. For example:
    //    console.error("ALWAYS show this error");
    // ------------------------------------------------------------------------

    debugLog("[Init] Starting RACING SCRIPT");

    // --- Utility Functions ---

    // Returns the value of a cookie by name.
    function getCookie(cname) {
        debugLog("[getCookie] Searching for cookie:", cname);
        var name = cname + "=";
        var ca = document.cookie.split(';');
        for (var i = 0; i < ca.length; i++) {
            var c = ca[i].trim();
            if (c.indexOf(name) === 0) {
                const cookieVal = c.substring(name.length, c.length);
                debugLog("[getCookie] Found cookie:", cname, "=", cookieVal);
                return cookieVal;
            }
        }
        debugLog("[getCookie] Cookie not found:", cname);
        return "";
    }

    // Retrieves player info from cookies and sessionStorage.
    function getPlayerInfo() {
        debugLog("[getPlayerInfo] Retrieving player info...");
        try {
            let uid = getCookie('uid');
            let data = JSON.parse(sessionStorage.getItem('sidebarData' + uid));
            if (data && data.user) {
                debugLog("[getPlayerInfo] Player found:", data.user.name, "with ID:", uid);
                return { id: uid, name: data.user.name };
            }
        } catch (error) {
            debugError("[getPlayerInfo] Error retrieving player info:", error);
        }
        debugLog("[getPlayerInfo] No valid player info. Returning default.");
        return { id: null, name: "Unknown Player" };
    }

    // --- Configuration & Constants ---
    debugLog("[Config] Configuration and constants set.");
    const SERVER_API_BASE = "https://lollipop.com/api/cars"; // Your server endpoint.
    const SHOW_SKINS = true; // Enable skin application.
    const SKIN_AWARDS = 'https://lollipop.com/custom/data';
    const SKIN_IMAGE = id => `https://lollipop.com/assets/${id}`;
    const RACE_ID = "*"; // Placeholder (replace if you have a specific race ID)

    let _skinOwnerCache = null; // Cache for skin data.
    let _skinned = null; // To prevent reapplying the same skin in the sidebar.

    // --- Main Initialization Function ---
    function initializeScript() {
        try {
            debugLog("[initializeScript] Running initialization logic...");

            const player = getPlayerInfo();
            if (!player.id) {
                debugError("[initializeScript] No player ID available. Aborting customization check.");
                return;
            }
            debugLog("[initializeScript] Fetching customization data for player ID:", player.id);
            fetchCustomizationData(player.id)
                .then(customization => {
                    if (customization) {
                        debugLog("[initializeScript] Customization data retrieved:", customization);
                        updateCarDisplay(customization);
                    } else {
                        debugLog("[initializeScript] No customization data found for player:", player.id);
                    }
                })
                .catch(error => debugError("[initializeScript] Error fetching customization data:", error));

            // Set up driver skin updates if skins are enabled.
            if (SHOW_SKINS && window.location.href.includes('sid=racing')) {
                debugLog("[initializeScript] Skins enabled; setting up driver skin updates.");
                let updatesContainer = document.getElementById('racingupdatesnew');
                if (updatesContainer) {
                    debugLog("[initializeScript] #racingupdatesnew found. Updating driver skins.");
                    updateDriverSkins();
                    let additionalContainer = document.getElementById('racingAdditionalContainer');
                    if (additionalContainer) {
                        debugLog("[initializeScript] Observing #racingAdditionalContainer for changes.");
                        new MutationObserver(updateDriverSkins)
                            .observe(additionalContainer, { childList: true });
                    }
                } else {
                    debugLog("[initializeScript] #racingupdatesnew not yet available. Setting observer for its appearance.");
                    let observer = new MutationObserver((mutations, obs) => {
                        updatesContainer = document.getElementById('racingupdatesnew');
                        if (updatesContainer) {
                            debugLog("[initializeScript/Observer] #racingupdatesnew now available. Updating driver skins.");
                            updateDriverSkins();
                            let additionalContainer = document.getElementById('racingAdditionalContainer');
                            if (additionalContainer) {
                                debugLog("[initializeScript/Observer] Observing #racingAdditionalContainer for further changes.");
                                new MutationObserver(updateDriverSkins)
                                    .observe(additionalContainer, { childList: true });
                            }
                            obs.disconnect();
                        }
                    });
                    observer.observe(document.body, { childList: true, subtree: true });
                }
            }

            // Set up the Customize Car button.
            debugLog("[initializeScript] Setting up the Customize Car button.");
            setupCustomizeCarButton();
        } catch (e) {
            debugError("[initializeScript] An error occurred:", e);
        }
    }

    // If the document is already loaded, run immediately. Otherwise, wait for DOMContentLoaded.
    if (document.readyState === "loading") {
        debugLog("[Main] Document is still loading. Waiting for DOMContentLoaded...");
        document.addEventListener("DOMContentLoaded", () => {
            debugLog("[Main] DOMContentLoaded event fired.");
            initializeScript();
        });
    } else {
        debugLog("[Main] Document already loaded. Running initialization immediately.");
        initializeScript();
    }

    // --- Server Communication Functions ---

    // Fetches customization data for a given user.
    function fetchCustomizationData(userId) {
        debugLog("[fetchCustomizationData] Requesting customization data for user:", userId);
        const url = `${SERVER_API_BASE}/${userId}`;
        return fetch(url)
            .then(response => {
                debugLog("[fetchCustomizationData] Server responded with status:", response.status);
                if (!response.ok) {
                    throw new Error(`Server returned ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                debugLog("[fetchCustomizationData] Data received:", data);
                return data && data.customization ? data.customization : null;
            })
            .catch(err => {
                debugError("[fetchCustomizationData] Fetch error:", err);
                throw err;
            });
    }

    // --- Display Update Functions ---

    // Updates the current user's car display based on customization data.
    function updateCarDisplay(customization) {
        debugLog("[updateCarDisplay] Applying customization to car display:", customization);
        let modelElement = document.querySelector(".car-selected .model p");
        if (modelElement && customization.carModel) {
            debugLog("[updateCarDisplay] Setting car model text to:", customization.carModel);
            modelElement.innerText = customization.carModel;
        }
        if (SHOW_SKINS && customization.carSkin) {
            debugLog("[updateCarDisplay] Applying car skin to sidebar:", customization.carSkin);
            skinCarSidebar(customization.carSkin);
        }
    }

    // Applies the car skin image to the sidebar for the current user.
    function skinCarSidebar(carSkin) {
        debugLog("[skinCarSidebar] Attempting to apply skin with ID:", carSkin);
        const carSelected = document.querySelector('.car-selected');
        if (!carSelected) {
            debugWarn("[skinCarSidebar] .car-selected element not found.");
            return;
        }
        const tornItem = carSelected.querySelector('.torn-item');
        if (!tornItem) {
            debugWarn("[skinCarSidebar] .torn-item image element not found.");
            return;
        }
        if (tornItem !== _skinned) {
            try {
                const skinUrl = SKIN_IMAGE(carSkin);
                debugLog("[skinCarSidebar] Setting image source to:", skinUrl);
                tornItem.setAttribute('src', skinUrl);
                tornItem.setAttribute('srcset', skinUrl);
                tornItem.style.display = 'block';
                tornItem.style.opacity = 1;
                const canvas = carSelected.querySelector('canvas');
                if (canvas) {
                    debugLog("[skinCarSidebar] Hiding fallback canvas element.");
                    canvas.style.display = 'none';
                }
                _skinned = tornItem;
            } catch (err) {
                debugError("[skinCarSidebar] Error applying skin:", err);
            }
        } else {
            debugLog("[skinCarSidebar] Skin already applied; no update needed.");
        }
    }

    // --- Driver List Skin Update Functions ---
    // Updates skins for drivers in the leaderboard.
    function updateDriverSkins() {
        debugLog("[updateDriverSkins] Initiating update of driver skins...");
        const leaderBoard = document.getElementById('leaderBoard');
        if (!leaderBoard) {
            debugWarn("[updateDriverSkins] Leaderboard element not found.");
            return;
        }
        monitorDriverListChanges(leaderBoard);

        const driverItems = leaderBoard.querySelectorAll('li[data-id]');
        if (!driverItems.length) {
            debugLog("[updateDriverSkins] No driver items found in leaderboard.");
            return;
        }
        debugLog("[updateDriverSkins] Found", driverItems.length, "driver items in leaderboard.");

        // Gather driver IDs from the first part of each data-id.
        const driverIds = [];
        driverItems.forEach(item => {
            const dataId = item.getAttribute('data-id');
            if (dataId) {
                const parts = dataId.split('-');
                if (parts.length > 0) {
                    driverIds.push(parts[0]);
                }
            }
        });
        debugLog("[updateDriverSkins] Collected driver IDs:", driverIds);

        // Retrieve skin data for these drivers.
        fetchDriverSkinOwners(driverIds).then(racingSkins => {
            debugLog("[updateDriverSkins] Received racing skin data:", racingSkins);
            driverItems.forEach(item => {
                const dataId = item.getAttribute('data-id');
                if (!dataId) return;
                const parts = dataId.split('-');
                if (parts.length < 1) return;
                const driverId = parts[0];
                if (SHOW_SKINS && racingSkins[driverId]) {
                    const carContainer = item.querySelector('.car');
                    if (!carContainer) {
                        debugWarn("[updateDriverSkins] No .car container found for driver", driverId);
                        return;
                    }
                    const carImg = carContainer.querySelector('img');
                    if (!carImg) {
                        debugWarn("[updateDriverSkins] No image found in .car container for driver", driverId);
                        return;
                    }
                    const carSrc = carImg.getAttribute('src');
                    const carId = carSrc.replace(/[^0-9]*/g, '');
                    if (racingSkins[driverId][carId]) {
                        const skinId = racingSkins[driverId][carId];
                        debugLog("[updateDriverSkins] Applying skin for driver", driverId, "with skin ID:", skinId);
                        carImg.setAttribute('src', SKIN_IMAGE(skinId));
                        const player = getPlayerInfo();
                        if (driverId === player.id) {
                            debugLog("[updateDriverSkins] Current user's driver found. Updating sidebar skin.");
                            skinCarSidebar(skinId);
                        }
                    } else {
                        debugLog("[updateDriverSkins] No matching skin for driver", driverId, "with carId:", carId);
                    }
                }
            });
        }).catch(error => {
            debugError("[updateDriverSkins] Error while updating driver skins:", error);
        });
    }

    // Monitors the leaderboard for content changes.
    function monitorDriverListChanges(driversList) {
        debugLog("[monitorDriverListChanges] Attaching MutationObserver to driver list.");
        if (driversList.dataset.hasObserver !== undefined) {
            debugLog("[monitorDriverListChanges] Observer already attached to driver list.");
            return;
        }
        new MutationObserver(updateDriverSkins).observe(driversList, { childList: true });
        driversList.dataset.hasObserver = 'true';
        debugLog("[monitorDriverListChanges] MutationObserver attached to driver list.");
    }

    // Fetches racing skin data for specified driver IDs.
    async function fetchDriverSkinOwners(driverIds) {
        debugLog("[fetchDriverSkinOwners] Requesting skin owners for driver IDs:", driverIds);
        function filterSkins(skins) {
            debugLog("[fetchDriverSkinOwners] Filtering skins for driver IDs:", driverIds);
            let result = {};
            for (const driverId of driverIds) {
                if (skins && skins[RACE_ID] && skins[RACE_ID][driverId]) {
                    result[driverId] = skins[RACE_ID][driverId];
                }
            }
            debugLog("[fetchDriverSkinOwners] Filtered skin data:", result);
            return result;
        }
        return new Promise(resolve => {
            if (_skinOwnerCache) {
                debugLog("[fetchDriverSkinOwners] Using cached skin data.");
                return resolve(_skinOwnerCache);
            }
            debugLog("[fetchDriverSkinOwners] Sending GM_xmlhttpRequest to:", SKIN_AWARDS);
            GM_xmlhttpRequest({
                method: 'GET',
                url: SKIN_AWARDS,
                headers: { 'Content-Type': 'application/json' },
                onload: ({ responseText }) => {
                    try {
                        _skinOwnerCache = JSON.parse(responseText);
                        debugLog("[fetchDriverSkinOwners] Skin data received and cached.");
                        resolve(_skinOwnerCache);
                    } catch (err) {
                        debugError("[fetchDriverSkinOwners] Error parsing skin data:", err);
                        resolve({});
                    }
                },
                onerror: (err) => {
                    debugError("[fetchDriverSkinOwners] Request error:", err);
                    resolve({});
                },
            });
        }).then(filterSkins);
    }

    // --- Customize Car Button Functions ---
    // Inserts the Customize Car button immediately to the left of the City link.
    function addCustomizeCarButton() {
        debugLog("[addCustomizeCarButton] Attempting to insert Customize Car button...");
        let topLinksList = document.getElementById("top-page-links-list");
        if (!topLinksList) {
            debugWarn("[addCustomizeCarButton] Top page links list container not found.");
            return;
        }
        let cityAnchor = topLinksList.querySelector("a[aria-labelledby='city']");
        if (!cityAnchor) {
            debugWarn("[addCustomizeCarButton] City anchor not found within top page links list.");
            return;
        }
        let customizeButton = document.createElement("a");
        customizeButton.setAttribute("role", "button");
        customizeButton.setAttribute("aria-labelledby", "customize-alert");
        customizeButton.href = "#";
        // Apply inline CSS based on the provided rules:
        customizeButton.style.cssText = `
            font-family: Arial;
            font-size: 12px;
            font-style: normal;
            font-variant: normal;
            font-weight: 700;
            letter-spacing: normal;
            line-height: 24px;
            text-decoration: rgb(204, 204, 204);
            text-align: start;
            text-indent: 0px;
            text-transform: none;
            vertical-align: baseline;
            white-space: nowrap;
            word-spacing: 0px;
            background-attachment: scroll;
            background-color: rgba(0, 0, 0, 0);
            background-image: none;
            background-position: 0% 0%;
            background-repeat: repeat;
            color: rgb(204, 204, 204);
            height: 26px;
            width: 47.6667px;
            border: 0px rgb(204, 204, 204);
            border-top: 0px rgb(204, 204, 204);
            border-right: 0px rgb(204, 204, 204);
            border-bottom: 0px rgb(204, 204, 204);
            border-left: 0px rgb(204, 204, 204);
            margin: 0px 26px 0px 0px;
            padding: 0px;
            max-height: none;
            min-height: 0px;
            max-width: none;
            min-width: 0px;
            position: relative;
            top: 0px;
            bottom: 0px;
            right: 0px;
            left: 0px;
            float: right;
            display: flex;
            clear: none;
            z-index: auto;
            list-style-image: none;
            list-style-type: disc;
            list-style-position: outside;
            border-collapse: separate;
            border-spacing: 0px;
            caption-side: top;
            empty-cells: show;
            table-layout: auto;
            overflow: visible;
            cursor: pointer;
            visibility: visible;
            transform: none;
            transition: all;
            outline-offset: 0px;
            box-sizing: content-box;
            resize: none;
            text-shadow: none;
            text-overflow: clip;
            word-wrap: normal;
            box-shadow: none;
            border-top-left-radius: 0px;
            border-top-right-radius: 0px;
            border-bottom-left-radius: 0px;
            border-bottom-right-radius: 0px;
        `;
        customizeButton.innerHTML = `
            <span style="display:inline-flex; align-items:center; justify-content:center; width:36px; height:36px;">
                <svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
	 width="100%" viewBox="0 0 608 608" enable-background="new 0 0 608 608" xml:space="preserve">
<path fill="#000000" opacity="1.000000" stroke="none"
	d="
M517.874023,336.503815
	C516.951416,339.639404 518.315613,343.008545 514.964600,344.992004
	C513.873291,345.637970 515.103271,347.090729 515.477356,348.153198
	C517.866760,354.939362 515.311707,360.152252 508.267090,361.840973
	C498.529572,364.175232 488.532410,364.756409 478.567841,365.304657
	C472.012970,365.665283 466.682159,366.833038 461.573761,372.392426
	C445.591858,389.785339 417.142456,388.061768 402.087860,369.416992
	C399.442078,366.140259 396.738983,365.117096 392.789215,365.081696
	C361.300385,364.799469 329.804077,364.690613 298.327942,363.855072
	C272.668640,363.173889 247.006683,363.690216 221.357925,362.944000
	C217.242844,362.824249 214.747421,364.174316 212.317780,367.563141
	C194.931625,391.812866 158.653748,389.486786 144.474152,363.206055
	C142.439514,359.435028 140.069717,357.228058 135.995316,355.747101
	C127.398582,352.622375 119.041046,348.820801 110.656189,345.135773
	C93.887856,337.766327 94.407478,325.391083 95.617424,309.422394
	C95.687866,308.492706 96.145081,307.231232 96.847130,306.768066
	C102.132851,303.280762 101.312302,298.143280 101.076141,292.946869
	C100.781319,286.459808 100.839142,279.949921 100.947159,273.453247
	C101.062683,266.505585 103.890968,263.831360 110.685822,263.663422
	C122.341927,263.375305 133.994980,262.938049 145.652313,262.742889
	C148.564697,262.694061 150.690430,261.284729 152.925949,259.851654
	C169.863571,248.993774 188.043152,240.835571 207.308426,235.129105
	C216.122864,232.518250 225.289001,231.434952 234.399170,231.071320
	C255.370239,230.234283 276.361755,230.055405 297.307495,232.053452
	C320.291443,234.245941 341.194519,242.583252 361.233704,253.517212
	C372.054962,259.421570 383.081909,264.987610 393.611176,271.373810
	C399.750854,275.097656 406.213440,276.025269 413.013062,276.724701
	C431.371735,278.613129 449.820831,280.003387 468.023102,282.911743
	C482.840210,285.279205 496.900726,290.453033 509.632843,299.035919
	C518.121765,304.758423 518.810974,312.879150 518.704712,321.603943
	C518.646057,326.424255 518.208191,331.239990 517.874023,336.503815
M501.895874,308.660095
	C495.277252,304.022552 487.884613,301.031372 480.285522,298.467926
	C467.881104,294.283417 454.985138,292.984894 442.052765,291.801300
	C426.815582,290.406799 411.609131,287.821472 396.360229,287.577759
	C357.877991,286.962708 319.378632,287.226013 280.887695,287.430634
	C261.204254,287.535248 241.610565,286.966522 222.224762,283.264313
	C210.571198,281.038757 199.177811,277.964905 188.788391,271.985107
	C185.349854,270.006042 183.444824,267.086395 185.584534,263.271301
	C187.671204,259.550720 191.014053,259.354675 194.632309,261.289001
	C196.977890,262.542908 199.319839,263.842590 201.777008,264.842621
	C220.589752,272.498962 240.444046,274.243866 260.456207,275.118073
	C263.159485,275.236145 264.027527,273.968628 264.027313,271.566864
	C264.026520,263.235687 264.012604,254.904343 264.064972,246.573441
	C264.083038,243.695709 262.938110,242.331207 259.905029,242.353180
	C244.578690,242.464188 229.193253,242.527435 214.220703,246.079269
	C193.941589,250.889954 175.380508,259.879639 157.972198,271.235260
	C154.370026,273.584961 150.747803,275.080170 146.365021,275.061981
	C137.035568,275.023254 127.703407,275.410126 118.375549,275.313751
	C114.406883,275.272766 113.119713,276.752228 113.238846,280.613525
	C113.464844,287.938507 113.293846,295.275238 113.324829,302.606934
	C113.339455,306.068237 112.379204,309.144623 110.134712,311.828796
	C104.527000,318.535156 106.173088,329.100647 113.893005,333.099762
	C120.381233,336.460754 127.262283,339.071869 134.012955,341.911530
	C135.592148,342.575836 137.120605,344.008606 139.072495,342.993591
	C143.806519,317.986572 158.095398,303.971497 178.879395,303.634918
	C188.728760,303.475403 197.671585,305.904572 205.453018,312.027802
	C217.873993,321.801941 221.918686,335.196747 221.250656,350.682281
	C278.828705,351.439850 335.865173,352.190247 393.318115,352.946167
	C392.577484,346.425659 392.581757,341.005371 393.659027,335.562073
	C396.808197,319.650146 409.778717,307.114777 426.598877,304.007568
	C441.599640,301.236450 458.779816,308.715881 466.988586,321.509644
	C472.116150,329.501190 474.274170,338.141876 473.494965,347.637054
	C473.316467,349.812195 471.635651,353.760651 476.311249,353.498230
	C483.445557,353.097809 490.557892,352.238647 497.662903,351.428406
	C499.472809,351.222046 501.404694,350.588226 501.560425,348.242950
	C502.269501,337.565491 507.185089,327.474731 505.768829,316.455292
	C505.387726,313.490326 505.136719,310.878296 501.895874,308.660095
M458.740997,356.131195
	C461.859528,349.171021 462.319611,342.161743 459.855469,334.819427
	C455.208099,320.971771 439.566223,312.841675 425.242889,317.086243
	C410.924133,321.329468 402.138428,336.684113 406.014221,350.799316
	C409.115875,362.095123 416.385925,369.411133 427.878937,371.515747
	C441.154572,373.946808 451.149719,368.777039 458.740997,356.131195
M153.429428,353.841675
	C159.122131,367.350861 169.865570,373.804321 184.440674,371.612183
	C196.087860,369.860443 203.637207,362.676331 206.737534,351.405334
	C209.910690,339.869507 206.670349,329.848022 197.409271,322.324188
	C188.509399,315.093750 178.323822,313.664520 167.952652,318.773743
	C155.247742,325.032593 150.321075,337.175903 153.429428,353.841675
M314.499878,275.609314
	C324.329224,275.604553 334.159271,275.673340 343.987671,275.574066
	C353.537933,275.477570 363.129517,275.968719 372.690613,274.518921
	C360.783661,266.776886 348.436859,260.624908 335.945709,254.766510
	C318.449402,246.560730 299.791504,243.789429 280.678894,243.172852
	C277.432800,243.068146 276.221832,244.298874 276.278809,247.534012
	C276.413818,255.195099 276.477509,262.865234 276.244507,270.521820
	C276.123077,274.511292 277.673218,275.748352 281.513855,275.683594
	C292.173248,275.503784 302.837494,275.613403 314.499878,275.609314
z"/>
</svg>
            </span>
            <span style="font-size: 12px; margin-left: 4px;">Customize Car</span>
        `;
        customizeButton.addEventListener("click", event => {
            event.preventDefault();
            debugLog("[Customize Car] Button clicked. Opening customization website...");
            window.open("https://lollipop.com/customize", "_blank");
        });
        topLinksList.insertBefore(customizeButton, cityAnchor);
        debugLog("[customizeButton] Customize Car button inserted to the left of the City link.");
    }

    // Observes for the top page links list container, then inserts the Customize Car button.
    function setupCustomizeCarButton() {
        debugLog("[setupCustomizeCarButton] Looking for top page links container...");
        let observer = new MutationObserver((mutations, obs) => {
            if (document.getElementById("top-page-links-list")) {
                debugLog("[setupCustomizeCarButton] Top page links container found. Inserting Customize Car button.");
                addCustomizeCarButton();
                obs.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

})();
