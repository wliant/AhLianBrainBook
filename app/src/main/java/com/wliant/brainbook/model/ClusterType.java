package com.wliant.brainbook.model;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

public enum ClusterType {

    KNOWLEDGE("knowledge"),
    AI_RESEARCH("ai-research"),
    PROJECT("project"),
    TODO("todo");

    private final String value;

    ClusterType(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }

    public static ClusterType fromValue(String value) {
        for (ClusterType t : values()) {
            if (t.value.equals(value)) {
                return t;
            }
        }
        throw new IllegalArgumentException("Unknown cluster type: " + value);
    }

    public boolean isUnique() {
        return this == AI_RESEARCH || this == TODO;
    }

    @Converter(autoApply = false)
    public static class JpaConverter implements AttributeConverter<ClusterType, String> {

        @Override
        public String convertToDatabaseColumn(ClusterType type) {
            return type != null ? type.getValue() : null;
        }

        @Override
        public ClusterType convertToEntityAttribute(String value) {
            return value != null ? ClusterType.fromValue(value) : null;
        }
    }
}
