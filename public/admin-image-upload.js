(() => {
  const form = document.querySelector("#productForm");
  if (!form) return;

  const mainInput = form.elements.main_image_file;
  const extraInput = form.elements.additional_image_files;
  const imagesField = form.elements.images;
  const mainPreview = document.querySelector("#productMainImagePreview");
  const mainSelected = document.querySelector("#productMainImageSelectedPreview");
  const extraPreview = document.querySelector("#productAdditionalImagePreview");
  const extraSelected = document.querySelector("#productAdditionalSelectedPreview");
  const countNote = document.querySelector("#productImageCount");
  let existingImages = [];
  let existingUrls = [];
  let objectUrls = [];

  const splitImages = value => String(value || "")
    .split(/\r?\n|\\n/)
    .map(value => value.trim())
    .filter(Boolean);

  const esc = value => String(value || "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));

  function clearObjectUrls() {
    objectUrls.forEach(url => URL.revokeObjectURL(url));
    objectUrls = [];
  }

  function renderCurrentImages() {
    const mainUrl = existingUrls[0] || "";
    mainPreview.innerHTML = mainUrl
      ? '<div class="image-preview-item primary-image-item"><img src="' + esc(mainUrl) + '" alt="الصورة الأساسية الحالية"><span>الصورة الأساسية الحالية</span></div>'
      : '<div class="image-preview-empty">لم يتم اختيار صورة أساسية بعد.</div>';

    const extras = existingUrls.slice(1);
    extraPreview.innerHTML = extras.length
      ? extras.map((url, index) => '<div class="image-preview-item"><img src="' + esc(url) + '" alt="صورة إضافية ' + (index + 1) + '"><span>صورة إضافية ' + (index + 1) + '</span></div>').join("")
      : '<div class="image-preview-empty">لا توجد صور إضافية محفوظة لهذا المنتج.</div>';
  }

  function renderSelectedFiles() {
    clearObjectUrls();
    const mainFile = mainInput.files && mainInput.files[0];
    mainSelected.innerHTML = "";
    if (mainFile) {
      const url = URL.createObjectURL(mainFile);
      objectUrls.push(url);
      mainSelected.innerHTML = '<div class="image-preview-item selected"><img src="' + url + '" alt="معاينة الصورة الأساسية الجديدة"><span>ستصبح الصورة الأساسية عند الحفظ</span></div>';
    }

    const extraFiles = Array.from(extraInput.files || []);
    extraSelected.innerHTML = extraFiles.map((file, index) => {
      const url = URL.createObjectURL(file);
      objectUrls.push(url);
      return '<div class="image-preview-item selected"><img src="' + url + '" alt="معاينة صورة إضافية"><span>صورة إضافية جديدة ' + (index + 1) + '</span></div>';
    }).join("");
    updateCount();
  }

  function updateCount() {
    const hasNewMainWithoutCurrent = !!(mainInput.files && mainInput.files.length) && existingImages.length === 0;
    const total = existingImages.length + (hasNewMainWithoutCurrent ? 1 : 0) + (extraInput.files ? extraInput.files.length : 0);
    countNote.textContent = "عدد الصور بعد الحفظ: " + total + " من 8 صور كحد أقصى.";
    countNote.classList.toggle("image-count-warning", total > 8);
  }

  document.addEventListener("jeloura:product-form", event => {
    const product = event.detail || null;
    existingImages = splitImages(imagesField.value);
    existingUrls = Array.isArray(product?.image_urls) ? product.image_urls.filter(Boolean) : [];
    if (!existingUrls.length && Array.isArray(product?.images)) {
      existingUrls = product.images.filter(url => /^https:\/\//i.test(String(url)));
    }
    mainInput.value = "";
    extraInput.value = "";
    renderCurrentImages();
    renderSelectedFiles();
  });

  mainInput.addEventListener("change", renderSelectedFiles);
  extraInput.addEventListener("change", () => {
    const newMainCount = mainInput.files && mainInput.files.length && existingImages.length === 0 ? 1 : 0;
    if (existingImages.length + newMainCount + extraInput.files.length > 8) {
      extraInput.value = "";
      renderSelectedFiles();
      document.querySelector("#productMessage").textContent = "الحد الأقصى 8 صور للمنتج: صورة أساسية و7 صور إضافية.";
      return;
    }
    document.querySelector("#productMessage").textContent = "";
    renderSelectedFiles();
  });

  function compress(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const image = new Image();
        image.onload = () => {
          const scale = Math.min(1, 1800 / Math.max(image.width, image.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          const context = canvas.getContext("2d");
          if (!context) return reject(new Error("تعذر تجهيز الصورة."));
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.82));
        };
        image.onerror = () => reject(new Error("تعذر قراءة إحدى الصور."));
        image.src = reader.result;
      };
      reader.onerror = () => reject(new Error("تعذر قراءة ملف الصورة."));
      reader.readAsDataURL(file);
    });
  }

  async function upload(file) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      throw new Error("اختاري صور JPG أو PNG أو WEBP فقط.");
    }
    const data = await compress(file);
    const response = await window.JelouraAdmin.apiFetch("/api/admin/upload-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "تعذر رفع إحدى الصور.");
    return result.key;
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    event.stopImmediatePropagation();

    const message = document.querySelector("#productMessage");
    const button = form.querySelector('[type="submit"]');
    const mainFile = mainInput.files && mainInput.files[0];
    const extraFiles = Array.from(extraInput.files || []);

    try {
      const newMainCount = mainFile && existingImages.length === 0 ? 1 : 0;
      if (existingImages.length + newMainCount + extraFiles.length > 8) {
        throw new Error("الحد الأقصى 8 صور للمنتج.");
      }
      if (extraFiles.length && !mainFile && existingImages.length === 0) {
        throw new Error("ارفعي الصورة الأساسية أولاً، ثم أضيفي باقي الصور.");
      }

      button.disabled = true;
      message.textContent = "جارٍ تجهيز الصور ورفعها...";

      const images = existingImages.slice();
      if (mainFile) {
        const key = await upload(mainFile);
        if (images.length) images[0] = key;
        else images.push(key);
      }
      for (const file of extraFiles) {
        images.push(await upload(file));
      }

      if (images.length > 8) throw new Error("الحد الأقصى 8 صور للمنتج.");
      imagesField.value = images.join(String.fromCharCode(10));

      const data = new FormData(form);
      const body = {
        id: data.get("id"),
        name: data.get("name"),
        category: data.get("category"),
        category_label: data.get("category_label"),
        price: data.get("price"),
        compare_at_price: data.get("compare_at_price"),
        stock: data.get("stock"),
        short_description: data.get("short_description"),
        long_description: data.get("long_description"),
        images,
        featured: form.elements.featured.checked,
        sale_enabled: form.elements.sale_enabled.checked,
        sale_ends_at: data.get("sale_ends_at") ? new Date(data.get("sale_ends_at")).toISOString() : null
      };

      message.textContent = "جارٍ حفظ بيانات المنتج...";
      const response = await window.JelouraAdmin.apiFetch("/api/admin/products", {
        method: body.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "تعذر حفظ المنتج.");

      document.querySelector("#productModal").classList.remove("open");
      clearObjectUrls();
      location.reload();
    } catch (error) {
      message.textContent = error.message || "حدث خطأ أثناء رفع الصور أو حفظ المنتج.";
    } finally {
      button.disabled = false;
    }
  }, true);

  document.querySelectorAll('[data-close="productModal"]').forEach(button => {
    button.addEventListener("click", clearObjectUrls);
  });
})();