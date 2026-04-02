package com.wliant.brainbook.model;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

public enum ResearchTopicStatus {

    GENERATING("generating"),
    READY("ready"),
    UPDATING("updating"),
    ERROR("error");

    private final String value;

    ResearchTopicStatus(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }

    public static ResearchTopicStatus fromValue(String value) {
        for (ResearchTopicStatus s : values()) {
            if (s.value.equals(value)) return s;
        }
        throw new IllegalArgumentException("Unknown research topic status: " + value);
    }

    @Converter(autoApply = false)
    public static class JpaConverter implements AttributeConverter<ResearchTopicStatus, String> {
        @Override
        public String convertToDatabaseColumn(ResearchTopicStatus status) {
            return status != null ? status.getValue() : null;
        }

        @Override
        public ResearchTopicStatus convertToEntityAttribute(String value) {
            return value != null ? ResearchTopicStatus.fromValue(value) : null;
        }
    }
}
