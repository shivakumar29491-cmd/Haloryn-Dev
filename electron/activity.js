document.getElementById("startSessionBtn").addEventListener("click", () => {
    const wrapper = document.getElementById("activityWrapper");
    wrapper.classList.add("slide-up");

    setTimeout(() => {
        window.companion.startSession();   // FIXED HERE
    }, 450);
});
