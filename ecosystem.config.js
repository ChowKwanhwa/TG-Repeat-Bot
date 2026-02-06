module.exports = {
    apps: [{
        name: "tg-sender",
        script: "./sender.py",
        interpreter: "./venv/bin/python",
        args: "--loop",
        autorestart: true,
        watch: false,
        env: {
            PYTHONUNBUFFERED: "1"
        }
    }, {
        name: "tg-api",
        script: "uvicorn",
        args: "web_manager:app --host 0.0.0.0 --port 8000",
        interpreter: "./venv/bin/python",
        autorestart: true
    }, {
        name: "tg-web",
        script: "npm",
        args: "start",
        cwd: "./web-manager",
        env: {
            PORT: "3000"
        }
    }]
}
