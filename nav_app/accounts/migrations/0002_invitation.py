from django.conf import settings
from django.db import migrations, models

import accounts.models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Invitation',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('token', models.CharField(default=accounts.models._generate_invitation_token, editable=False, max_length=64, unique=True)),
                ('role', models.CharField(choices=[('teacher', 'Teacher'), ('student', 'Student')], max_length=16)),
                ('note', models.CharField(blank=True, help_text='Optional label to remember who this invite is for.', max_length=120)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('expires_at', models.DateTimeField(default=accounts.models._default_invitation_expiry)),
                ('used_at', models.DateTimeField(blank=True, null=True)),
                ('created_by', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='invitations_sent', to=settings.AUTH_USER_MODEL)),
                ('used_by', models.ForeignKey(blank=True, null=True, on_delete=models.deletion.SET_NULL, related_name='invitation_used', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ('-created_at',),
            },
        ),
    ]