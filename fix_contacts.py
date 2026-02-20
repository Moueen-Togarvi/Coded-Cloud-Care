import glob
import os
import re

email_pattern = r'support@pharmxpro\.com'
new_email = 'hashim@codedclouds.org'

phone_pattern = r'\+1\s*\(555\)\s*000-1234'
new_phone = '+966-557385262 / +92 302 5815858'

files = glob.glob('/home/moueen-togarvi/code/Coded-Cloud-Care/Frontend/pharmacy/*.html')

for fpath in files:
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace email
    content = re.sub(email_pattern, new_email, content)
    
    # Replace phone
    content = re.sub(phone_pattern, new_phone, content)
    
    with open(fpath, 'w', encoding='utf-8') as f:
        f.write(content)

print(f"Updated {len(files)} files.")
