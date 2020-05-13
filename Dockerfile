# build stage
FROM golang:alpine AS build-env
ADD . /src
RUN cd /src && go build -o dashboard cmd/dashboard/dashboard.go

# final stage
FROM alpine
WORKDIR /app
COPY --from=build-env /src/dashboard /app/
COPY --from=build-env /src/static /app/static
EXPOSE 8080
ENTRYPOINT /app/dashboard
