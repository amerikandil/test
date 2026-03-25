document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector(".contact-form");
  if (!form) return;

  const status = document.createElement("p");
  status.className = "form-status";
  status.setAttribute("aria-live", "polite");
  form.appendChild(status);

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const fullName = form.fullName.value.trim();
    const phone = form.phone.value.trim();
    const email = form.email.value.trim();
    const visaType = form.visaType.value;

    if (!fullName || !phone || !email || !visaType) {
      status.textContent = "Lütfen zorunlu alanları eksiksiz doldurun.";
      status.classList.add("error");
      status.classList.remove("success");
      return;
    }

    const leadData = {
      fullName,
      phone,
      email,
      visaType,
      message: form.message.value.trim(),
      createdAt: new Date().toISOString(),
    };

    const previousLeads = JSON.parse(localStorage.getItem("vizeplusLeads") || "[]");
    previousLeads.push(leadData);
    localStorage.setItem("vizeplusLeads", JSON.stringify(previousLeads));

    status.textContent = "Bilgileriniz alındı. En kısa sürede sizi arayacağız.";
    status.classList.add("success");
    status.classList.remove("error");
    form.reset();
  });
});
