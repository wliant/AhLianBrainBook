# Build context must be the project root (set via docker-compose build.context: .)
FROM gradle:8.12-jdk21 AS build
WORKDIR /app
COPY app/build.gradle.kts app/settings.gradle.kts ./
COPY app/gradle ./gradle
COPY proto ../proto
RUN gradle dependencies --no-daemon
COPY app/src ./src
RUN gradle bootJar --no-daemon -x test

FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=build /app/build/libs/*.jar app.jar
USER app
ENV TZ=UTC
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:8080/actuator/health || exit 1
ENTRYPOINT ["java", "-jar", "app.jar"]
