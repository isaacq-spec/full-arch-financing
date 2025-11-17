// POINT TO YOUR LIVE BACKEND
const API_BASE = "https://full-arch-financing.onrender.com/api";

async function createPlan() {
    const name = document.getElementById("name").value;
    const email = document.getElementById("email").value;
    const totalFee = Number(document.getElementById("totalFee").value);
    const termMonths = Number(document.getElementById("termMonths").value);
    const downPercentInput = Number(document.getElementById("downPercent").value);

    const data = {
        name,
        email,
        totalFee,
        termMonths,
        // backend expects a decimal (0.2 for 20%)
        downPercent: downPercentInput / 100
    };

    try {
        const res = await fetch(`${API_BASE}/create-plan`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });

        const result = await res.json();
        console.log("create-plan result:", result);

        if (!res.ok) {
            // 👇 show the backend's detailed error if available
            throw new Error(result.details || result.error || "Failed to create plan");
        }

        document.getElementById("dp").innerText = result.downPaymentAmount.toFixed(2);
        document.getElementById("remaining").innerText = result.remaining.toFixed(2);
        document.getElementById("monthly").innerText = result.monthly.toFixed(2);

        document.getElementById("paymentLink").href = result.paymentLinkUrl;
        document.getElementById("paymentLink").innerText = result.paymentLinkUrl;

        document.getElementById("results").classList.remove("hidden");
        document.getElementById("autopayCard").classList.remove("hidden");

        document.getElementById("customerId").value = result.customerId;
        document.getElementById("remainingInput").value = result.remaining;
        document.getElementById("termInput").value = termMonths;
    } catch (err) {
        console.error("createPlan error:", err);
        alert("Error: " + err.message);
    }
}

async function createAutopay() {
    const data = {
        customerId: document.getElementById("customerId").value,
        remaining: Number(document.getElementById("remainingInput").value),
        termMonths: Number(document.getElementById("termInput").value)
    };

    try {
        const res = await fetch(`${API_BASE}/create-invoice-schedule`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });

        const result = await res.json();
        console.log("create-invoice-schedule result:", result);

        if (!res.ok) {
            throw new Error(result.details || result.error || "Failed to create subscription");
        }

        document.getElementById("autopayResult").innerText =
            "Subscription Created: " + result.subscriptionId;
    } catch (err) {
        console.error("createAutopay error:", err);
        alert("Error: " + err.message);
    }
}

