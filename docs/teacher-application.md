# Teacher application workflow

Selecting the `TEACHER` role does not make a user a public or
bookable teacher.

It creates a private teacher application.

## Application states

### DRAFT

The applicant may:

- Complete or edit the professional profile
- Upload or replace the introduction video
- Switch to a student account
- Submit the completed application

The applicant may not:

- Create availability
- Appear in teacher search
- Receive bookings

### PENDING_REVIEW

The application is waiting for administrative review.

The applicant may not:

- Create availability
- Appear publicly
- Receive bookings

### APPROVED

The teacher may:

- Appear in public teacher discovery
- Create availability
- Receive bookings

Public visibility additionally requires:

- A completed teacher profile
- An approved introduction video
- An active user account

### REJECTED

The applicant may:

- Read the review note
- Edit the profile
- Replace the introduction video
- Resubmit the application
- Switch to a student account

### SUSPENDED

The teacher is not publicly visible and cannot receive new bookings.

## Introduction video

Requirements:

- Minimum duration: 60 seconds
- Maximum duration: 120 seconds
- One active introduction video per teacher
- The video must be approved before public publication
- Replacement videos require a new review

## Authorization rule

Teacher-role access is not sufficient for availability or booking.

Availability creation requires:

```text
applicationStatus = APPROVED