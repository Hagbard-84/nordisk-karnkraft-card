ARG BUILD_FROM=ghcr.io/home-assistant/base:latest
FROM $BUILD_FROM

RUN apk add --no-cache python3

COPY run.sh /run.sh
COPY main.py /app/main.py
COPY nordisk-karnkraft-card.js /app/nordisk-karnkraft-card.js
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]
