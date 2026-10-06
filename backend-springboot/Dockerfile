FROM eclipse-temurin:21-jdk AS build
WORKDIR /src
COPY gradlew settings.gradle build.gradle ./
COPY gradle ./gradle
RUN ./gradlew --no-daemon dependencies > /dev/null
COPY src/main ./src/main
RUN ./gradlew --no-daemon bootJar -x test && cp $(ls build/libs/*.jar | grep -v plain) /app.jar

FROM eclipse-temurin:21-jre
COPY --from=build /app.jar /app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app.jar"]
