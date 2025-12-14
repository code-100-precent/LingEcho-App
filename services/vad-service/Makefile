.PHONY: install run test docker-build docker-run clean

install:
	pip install -r requirements.txt

run:
	python vad_service.py

test:
	curl -X GET http://localhost:7073/health

docker-build:
	docker build -t vad-service .

docker-run:
	docker run -p 7073:7073 -v $(PWD)/rtcmedia:/app/rtcmedia vad-service

clean:
	find . -type d -name __pycache__ -exec rm -r {} +
	find . -type f -name "*.pyc" -delete
	find . -type f -name "*.pyo" -delete

