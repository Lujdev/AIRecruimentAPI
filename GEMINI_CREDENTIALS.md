# Configuración de Credenciales de Gemini API

Para utilizar la API de Gemini para la evaluación de CVs, necesitas obtener una clave de API desde Google AI Studio y configurarla en tu entorno.

## Pasos para Obtener la Clave de API

1.  **Ve a Google AI Studio:** Abre tu navegador y ve a [https://aistudio.google.com/](https://aistudio.google.com/).
2.  **Inicia Sesión:** Inicia sesión con tu cuenta de Google.
3.  **Crea una Clave de API:**
    *   Busca y haz clic en el botón **"Get API key"** (Obtener clave de API).
    *   En el menú que aparece, selecciona **"Create API key in new project"** (Crear clave de API en un nuevo proyecto).
    *   Copia la clave de API generada. Esta clave es secreta y no debes compartirla públicamente.

## Configuración de las Variables de Entorno

La clave de API debe ser configurada como una variable de entorno en el archivo `.env` de tu proyecto.

1.  **Busca o crea el archivo `.env`:** En la raíz de tu proyecto, busca un archivo llamado `.env`. Si no existe, puedes renombrar el archivo `example.env` a `.env`.

2.  **Añade la clave al archivo `.env`:** Abre el archivo `.env` y añade la siguiente línea, reemplazando `TU_GEMINI_API_KEY` con la clave que copiaste de Google AI Studio:

    ```
    GEMINI_API_KEY=TU_GEMINI_API_KEY
    ```

3.  **Asegúrate de que `.env` esté en `.gitignore`:** Para evitar que tu clave de API se suba accidentalmente a un repositorio de código, asegúrate de que el archivo `.gitignore` contenga la siguiente línea:

    ```
    .env
    ```

4.  **Reinicia la Aplicación:** Si tu servidor se estaba ejecutando, reinícialo para que las nuevas variables de entorno se carguen correctamente.

Con estos pasos, tu aplicación estará configurada para usar la API de Gemini.