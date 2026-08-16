FROM libreoffice:7.6

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 \
    && rm -rf /var/lib/apt/lists/*

COPY converter.py /usr/local/bin/edms-converter.py
RUN chmod +x /usr/local/bin/edms-converter.py

EXPOSE 8100

CMD ["python3", "/usr/local/bin/edms-converter.py"]
